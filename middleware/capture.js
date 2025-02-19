const captureResponseBody = (req, res, next) => {
    const oldWrite = res.write;
    const oldEnd = res.end;
    const chunks = [];

    res.write = function(chunk, ...args) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
        } else if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk));
        }
        return oldWrite.apply(res, [chunk, ...args]);
    };

    res.end = function(chunk, ...args) {
        if (chunk) {
            if (Buffer.isBuffer(chunk)) {
                chunks.push(chunk);
            } else if (typeof chunk === 'string') {
                chunks.push(Buffer.from(chunk));
            }
        }
        const body = Buffer.concat(chunks).toString('utf8');
        res._responseBody = body;
        oldEnd.apply(res, [chunk, ...args]);
    };

    next();
};

module.exports = captureResponseBody;