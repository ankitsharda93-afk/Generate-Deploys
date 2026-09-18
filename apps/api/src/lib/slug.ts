import slugify from "slugify";

export function toSlug(input: string) {
  return slugify(input, { lower: true, strict: true, trim: true });
}

