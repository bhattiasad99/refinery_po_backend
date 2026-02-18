---
to: <%= name %>/nodemon.json
---
{
    "watch": [
        "src"
    ],
    "ext": "ts",
    "ignore": [
        "dist"
    ],
    "exec": "ts-node src/index.ts"
}
