export const decimalTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    return Number(value);
  },
};
