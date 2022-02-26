import { createMarkdown, createLatex } from '../static/js/extern.js'

let inp = ['**testing**', 'hello'];
let out = await createLatex(inp);
out = out.data;

console.log(inp);
console.log(out);
