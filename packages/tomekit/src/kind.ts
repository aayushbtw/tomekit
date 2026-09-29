type Primitive = bigint | boolean | number | string | symbol;

// `new Object(value)` returns an object itself and boxes anything else.
function isObject(value: unknown): value is object {
  return Object.is(new Object(value), value);
}

function isPrimitive(value: unknown): value is Primitive {
  return value !== null && value !== undefined && !isObject(value);
}

// `Object.getPrototypeOf` boxes a primitive, so its prototype names its type without `typeof`.
function isBigInt(value: unknown): value is bigint {
  return (
    isPrimitive(value) && Object.getPrototypeOf(value) === BigInt.prototype
  );
}

function isBoolean(value: unknown): value is boolean {
  return (
    isPrimitive(value) && Object.getPrototypeOf(value) === Boolean.prototype
  );
}

function isNumber(value: unknown): value is number {
  return (
    isPrimitive(value) && Object.getPrototypeOf(value) === Number.prototype
  );
}

function isString(value: unknown): value is string {
  return (
    isPrimitive(value) && Object.getPrototypeOf(value) === String.prototype
  );
}

function isSymbol(value: unknown): value is symbol {
  return (
    isPrimitive(value) && Object.getPrototypeOf(value) === Symbol.prototype
  );
}

// Async and generator functions have their own prototypes, which inherit from `Function.prototype`.
function isFunction(value: unknown): value is (...args: never[]) => void {
  return (
    isObject(value) &&
    Object.prototype.isPrototypeOf.call(Function.prototype, value)
  );
}

export {
  isBigInt,
  isBoolean,
  isFunction,
  isNumber,
  isObject,
  isPrimitive,
  isString,
  isSymbol,
  type Primitive,
};
