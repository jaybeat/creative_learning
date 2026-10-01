/* 三问共用：有序单链表（指数从高到低），带头结点。只存非零项 */
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int coef;
    int exp;
    struct Node *next;
} Node;

static Node *NewPoly(void) {
    Node *h = malloc(sizeof(Node));
    h->next = NULL;
    return h;
}

/* 把一项 c·x^e 加进多项式：找到位置，同类项合并，合并成 0 就删掉 */
static void AddTerm(Node *h, int c, int e) {
    if (c == 0) return;
    Node *p = h;
    while (p->next && p->next->exp > e) p = p->next;
    if (p->next && p->next->exp == e) {
        p->next->coef += c;
        if (p->next->coef == 0) {
            Node *q = p->next;
            p->next = q->next;
            free(q);
        }
        return;
    }
    Node *s = malloc(sizeof(Node));
    s->coef = c;
    s->exp = e;
    s->next = p->next;
    p->next = s;
}

static Node *ReadPoly(void) {
    Node *h = NewPoly();
    int n, c, e;
    if (scanf("%d", &n) != 1) return h;
    for (int i = 0; i < n; i++) {
        scanf("%d %d", &c, &e);
        AddTerm(h, c, e);
    }
    return h;
}

static void PrintPoly(Node *h) {
    if (!h->next) {
        printf("0\n");
        return;
    }
    for (Node *p = h->next; p; p = p->next) {
        int a = p->coef < 0 ? -p->coef : p->coef;
        if (p == h->next) {
            if (p->coef < 0) printf("-");
        } else {
            printf(p->coef < 0 ? " - " : " + ");
        }
        if (p->exp == 0) printf("%d", a);
        else {
            if (a != 1) printf("%d", a);
            if (p->exp == 1) printf("x");
            else printf("x^%d", p->exp);
        }
    }
    printf("\n");
}
