const multer = require('multer');

const MEMORY_FOR_BUFFERS = Math.floor(10 * 1024 * 1024 * 1024 * 0.2);

const upload = multer({
    limits: {
        fileSize: MEMORY_FOR_BUFFERS / 10,
    },
    storage: multer.memoryStorage()
}).single('file');

const handleUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
            const uploadWithFile = multer({
                limits: {
                    fileSize: MEMORY_FOR_BUFFERS / 10,
                },
                storage: multer.memoryStorage()
            }).single('File');

            uploadWithFile(req, res, next);
        } else {
            next(err);
        }
    });
};

module.exports = handleUpload;