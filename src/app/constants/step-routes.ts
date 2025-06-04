export const stepRoutes: Record<number, (id: number) => string[]> = {
    1: (id) => [`/test/edit/${id}`],
    2: (id) => [`/test-blocks/edit/${id}`],
    3: (id) => [`/test-scales/edit/${id}`],
    4: (id) => [`/test-questions/edit/${id}`],
    5: (id) => [`/test-answers/edit/${id}`],
    6: (id) => [`/test-weights/edit/${id}`],
    7: (id) => [`/test-norms/edit/${id}`],
    8: (id) => [`/test-interpretations/edit/${id}`]
};
