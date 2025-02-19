const normalizeKeys = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(normalizeKeys);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
                key.toLowerCase(),
                normalizeKeys(value)
            ])
        );
    }
    return obj;
};

module.exports = {
    normalizeKeys
};