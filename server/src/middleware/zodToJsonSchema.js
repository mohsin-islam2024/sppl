/**
 * Small helper that turns a Zod object schema into a plain JSON-Schema-ish shape.
 *
 * The API docs endpoint (and the frontend form generators) want a lightweight
 * description of a payload. Pulling in a full JSON Schema converter for this is
 * unnecessary, so only the pieces the docs actually render are mapped: type,
 * required fields, enum values and defaults.
 */
import { z } from "zod";

const typeOf = (schema) => {
  const def = schema?._def;
  if (!def) return "unknown";
  switch (def.typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodDate":
      return "string";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    case "ZodEnum":
      return "enum";
    case "ZodDefault":
      return typeOf(def.innerType);
    case "ZodOptional":
      return typeOf(def.innerType);
    case "ZodNullable":
      return typeOf(def.innerType);
    case "ZodUnion":
      return "union";
    case "ZodEffects":
      return typeOf(def.schema);
    case "ZodLiteral":
      return typeof def.value;
    default:
      return "unknown";
  }
};

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {object}
 */
export default function zodToJsonSchema(schema) {
  if (!(schema instanceof z.ZodObject)) {
    return { type: typeOf(schema), description: schema?.description ?? "" };
  }

  const shape = schema.shape;
  const properties = {};
  const required = [];

  for (const [key, value] of Object.entries(shape)) {
    const def = value?._def;
    const isOptional =
      def?.typeName === "ZodOptional" ||
      def?.typeName === "ZodDefault" ||
      def?.typeName === "ZodNullable";

    properties[key] = {
      type: typeOf(value),
      ...(def?.typeName === "ZodEnum" ? { enum: def.values } : {}),
      ...(def?.typeName === "ZodDefault"
        ? { default: def.defaultValue() }
        : {}),
      ...(value?.description ? { description: value.description } : {}),
    };

    if (!isOptional) required.push(key);
  }

  return { type: "object", properties, required };
}
