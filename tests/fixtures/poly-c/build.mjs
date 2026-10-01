// 把 common.h 内联进每一问的解答，得到能直接提交的单文件代码
import fs from 'node:fs'
import path from 'node:path'
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const common = fs.readFileSync(path.join(dir, 'common.h'), 'utf8')
export const solutions = {
  'ch02-ex-1': common + '\nint main(void) {\n    PrintPoly(ReadPoly());\n    return 0;\n}\n',
  'ch02-ex-2':
    common +
    '\nint main(void) {\n    Node *a = ReadPoly(), *b = ReadPoly();\n    Node *s = NewPoly(), *d = NewPoly();\n' +
    '    for (Node *p = a->next; p; p = p->next) { AddTerm(s, p->coef, p->exp); AddTerm(d, p->coef, p->exp); }\n' +
    '    for (Node *p = b->next; p; p = p->next) { AddTerm(s, p->coef, p->exp); AddTerm(d, -p->coef, p->exp); }\n' +
    '    PrintPoly(s);\n    PrintPoly(d);\n    return 0;\n}\n',
  'ch02-ex-3':
    common +
    '\nint main(void) {\n    Node *a = ReadPoly(), *b = ReadPoly();\n    Node *m = NewPoly();\n' +
    '    for (Node *p = a->next; p; p = p->next)\n        for (Node *q = b->next; q; q = q->next) AddTerm(m, p->coef * q->coef, p->exp + q->exp);\n' +
    '    PrintPoly(m);\n    return 0;\n}\n',
}
