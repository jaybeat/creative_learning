/* 二叉树的结点表 · 第一问：结点信息（标准解答） */
#include <stdio.h>

#define MAXN 1000

char val[MAXN];
int lc[MAXN], rc[MAXN];   /* 左孩子、右孩子的编号，-1 表示没有 */
int parent[MAXN];

int main(void) {
    int n;
    scanf("%d", &n);
    for (int k = 0; k < n; k++) {
        int i;
        scanf("%d", &i);
        scanf(" %c %d %d", &val[i], &lc[i], &rc[i]);
    }
    /* 由孩子推出双亲：没当过孩子的就是根 */
    for (int i = 0; i < n; i++) parent[i] = -1;
    for (int i = 0; i < n; i++) {
        if (lc[i] != -1) parent[lc[i]] = i;
        if (rc[i] != -1) parent[rc[i]] = i;
    }
    int root = 0;
    while (parent[root] != -1) root++;
    printf("%d\n", root);

    int cnt[3] = {0, 0, 0};
    for (int i = 0; i < n; i++) {
        int d = (lc[i] != -1) + (rc[i] != -1);
        cnt[d]++;
        printf("%d %d\n", parent[i], d);
    }
    printf("%d %d %d\n", cnt[0], cnt[1], cnt[2]);
    return 0;
}
