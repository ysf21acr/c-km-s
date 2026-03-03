const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validasyon hatası',
                details: err.errors
            });
        }
        next(err);
    }
};

module.exports = { validate };
