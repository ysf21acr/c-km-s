const express = require('express');
const router = express.Router();
const Iyzipay = require('iyzipay');
const iyzipayClient = require('../services/iyzico');
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Parse URL-encoded bodies for callback (Iyzico sends POST data)
router.use('/callback', express.urlencoded({ extended: true }));

// Initialize Iyzico Checkout Form
router.post('/initialize', authMiddleware, (req, res) => {
    const user = req.user;
    const db = getDb();

    const priceRow = db.prepare("SELECT value FROM settings WHERE key = 'monthly_price'").get();
    const price = priceRow ? priceRow.value : "49.99";

    const conversationId = crypto.randomBytes(16).toString('hex');

    const nameParts = user.name ? user.name.split(' ') : ['User', 'Name'];
    const name = nameParts[0] || 'User';
    const surname = nameParts.slice(1).join(' ') || 'Name';

    const baseUrl = req.protocol + '://' + req.get('host');

    const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: conversationId,
        price: price,
        paidPrice: price,
        currency: Iyzipay.CURRENCY.TRY,
        basketId: "PREMIUM_" + user.id,
        paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
        callbackUrl: process.env.BASE_URL ? `${process.env.BASE_URL}/api/payment/callback` : `${baseUrl}/api/payment/callback`,
        enabledInstallments: [1],
        buyer: {
            id: String(user.id),
            name: name,
            surname: surname,
            gsmNumber: "+905000000000",
            email: user.email,
            identityNumber: "11111111111", // Mocked for sandbox
            lastLoginDate: "2015-10-05 12:43:35",
            registrationDate: "2013-04-21 15:12:09",
            registrationAddress: "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
            ip: req.ip || "85.34.78.112",
            city: "Istanbul",
            country: "Turkey",
            zipCode: "34732"
        },
        shippingAddress: {
            contactName: name + " " + surname,
            city: "Istanbul",
            country: "Turkey",
            address: "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
            zipCode: "34732"
        },
        billingAddress: {
            contactName: name + " " + surname,
            city: "Istanbul",
            country: "Turkey",
            address: "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
            zipCode: "34732"
        },
        basketItems: [
            {
                id: "PREMIUM",
                name: "1 Aylık Premium Abonelik",
                category1: "Subscription",
                itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
                price: price
            }
        ]
    };

    iyzipayClient.checkoutFormInitialize.create(request, function (err, result) {
        if (err || result.status !== 'success') {
            console.error('Checkout error:', err || result);
            return res.status(500).json({ error: 'Ödeme formu oluşturulamadı', details: result?.errorMessage });
        }

        res.json({
            status: 'success',
            checkoutFormContent: result.checkoutFormContent,
            token: result.token,
            paymentPageUrl: result.paymentPageUrl
        });
    });
});

// Handle Iyzico Callback
router.post('/callback', (req, res) => {
    const token = req.body.token;

    if (!token) {
        return res.redirect('/#app/subscription?status=error&message=Token_bulunamadi');
    }

    const request = {
        locale: Iyzipay.LOCALE.TR,
        token: token
    };

    iyzipayClient.checkoutForm.retrieve(request, function (err, result) {
        if (err || result.paymentStatus !== 'SUCCESS') {
            console.error('Payment failed:', err || result);
            return res.redirect(`/#app/subscription?status=error&message=${encodeURIComponent(result?.errorMessage || 'Ödeme başarısız')}`);
        }

        try {
            const db = getDb();
            const userId = result.buyerId;
            const price = result.price;
            const paidPrice = result.paidPrice;
            const paymentId = result.paymentId;

            // Log payment
            db.prepare(`
                INSERT INTO payments (user_id, payment_id, conversation_id, price, paid_price, currency, status, card_brand, last_four_digits)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                userId, paymentId, result.conversationId || '', price, paidPrice, result.currency,
                result.paymentStatus, result.cardAssociation, result.lastFourDigits
            );

            // Turn off old subscriptions
            db.prepare('UPDATE subscriptions SET is_active = 0 WHERE user_id = ?').run(userId);

            // Add new subscription
            db.prepare(`
                INSERT INTO subscriptions (user_id, plan, starts_at, expires_at, is_active)
                VALUES (?, 'premium', datetime('now'), datetime('now', '+1 month'), 1)
            `).run(userId);

            // Send confirmation email
            try {
                const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(userId);
                if (user && user.email) {
                    const transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
                        port: process.env.SMTP_PORT || 587,
                        auth: {
                            user: process.env.SMTP_USER || 'dummy',
                            pass: process.env.SMTP_PASS || 'dummy'
                        }
                    });
                    transporter.sendMail({
                        from: '"MedDoc Akademi" <noreply@meddoc.com>',
                        to: user.email,
                        subject: 'Premium Aboneliğiniz Başlatıldı 🎉',
                        html: `<h3>Merhaba ${user.name},</h3><p>MedDoc Akademi Premium aboneliğiniz başarıyla başlatıldı. Sınırsız sınav çözmeye hemen başlayabilirsiniz!</p><p>Ödediğiniz tutar: ${paidPrice} ${result.currency}</p>`
                    }).catch(e => console.error('Mail error:', e));
                }
            } catch (mailErr) {
                console.error('Email could not be sent', mailErr);
            }

            return res.redirect('/#app/subscription?status=success');
        } catch (dbErr) {
            console.error('DB Error handling callback:', dbErr);
            return res.redirect('/#app/subscription?status=error&message=DB_Error');
        }
    });
});

module.exports = router;
