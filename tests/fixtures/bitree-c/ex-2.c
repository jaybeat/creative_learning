/* 二叉树的结点表 · 第二问：三种遍历（标准解答） */
#include <stdio.h>

#define MAXN 1000

char val[MAXN];
int lc[MAXN], rc[MAXN];   /* 左孩子、右孩子的编号，-1 表示没有 */
int isChild[MAXN];

void PreOrder(int t) {
    if (t == -1) return;
    printf("%c ", val[t]);
    PreOrder(lc[t]);
    PreOrder(rc[t]);
}

void InOrder(int t) {
    if (t == -1) return;
    InOrder(lc[t]);
    printf("%c ", val[t]);
    InOrder(rc[t]);
}

void PostOrder(int t) {
    if (t == -1) return;
    PostOrder(lc[t]);
    PostOrder(rc[t]);
    printf("%c ", val[t]);
}

int main(void) {
    int n;
    scanf("%d", &n);
    for (int k = 0; k < n; k++) {
        int i;
        scanf("%d", &i);
        scanf(" %c %d %d", &val[i], &lc[i], &rc[i]);
    }
    for (int i = 0; i < n; i++) {
        if (lc[i] != -1) isChild[lc[i]] = 1;
        if (rc[i] != -1) isChild[rc[i]] = 1;
    }
    int root = 0;
    while (isChild[root]) root++;

    PreOrder(root);
    printf("\n");
    InOrder(root);
    printf("\n");
    PostOrder(root);
    printf("\n");
    return 0;
}
