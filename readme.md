## Moon

Moon is an minimal, JIT-compilable, secure code-interchange format. It is:

- **Safe:** Moon isolates logic from side-effects, allowing you to securely run code from untrusted sources.

- **Fast:** when compiled to JS, it beats popular libs by [a large margin](moon-demo/demo-performance.js).

- **Compact:** Moon has a canonical binary format for very small bundles.

- **Decentralized:** Moon imports are hash-addressed, recursively resolved from [IPFS](https://ipfs.io/).

- **Small:** this entire implementation, for example, is a 7.5K JS file (gzipped).

Formally, it consists of the untyped λ-calculus extended with numbers, strings and maps.
