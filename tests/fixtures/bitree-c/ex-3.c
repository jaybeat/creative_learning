/* 二叉树的结点表 · 第三问：树的高度（标准解答） */
#include <stdio.h>

#define MAXN 1000

char val[MAXN];
int lc[MAXN], rc[MAXN];   /* 左孩子、右孩子的编号，-1 表示没有 */
int isChild[MAXN];
int h[MAXN];              /* h[i]：以 i 为根的子树的高度 */

/* 往下交、往上合：算出 t 这棵子树的高度，顺手记进 h[t] */
int Depth(int t) {
    if (t == -1) return 0;                 /* 空树：高度0 */
    int l = Depth(lc[t]);
    int r = Depth(rc[t]);
    h[t] = (l > r ? l : r) + 1;
    return h[t];
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

    printf("%d\n", Depth(root));
    for (int i = 0; i < n; i++) printf("%d\n", h[i]);
    return 0;
}
