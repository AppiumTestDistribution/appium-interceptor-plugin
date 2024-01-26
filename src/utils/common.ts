const getAllProperties = (object: any) => {
  const properties = new Set();

  do {
    for (const key of Reflect.ownKeys(object)) {
      properties.add([object, key]);
    }
  } while ((object = Reflect.getPrototypeOf(object)) && object !== Object.prototype);

  return properties;
};

export default function autoBind(
  self: object,
  { include, exclude }: { include?: string[]; exclude?: string[] } = {}
) {
  const filter = (key: string) => {
    const match = (pattern: string | RegExp) =>
      typeof pattern === 'string' ? key === pattern : pattern.test(key);

    if (include) {
      return include.some(match); // eslint-disable-line unicorn/no-array-callback-reference
    }

    if (exclude) {
      return !exclude.some(match); // eslint-disable-line unicorn/no-array-callback-reference
    }

    return true;
  };

  for (const [object, key] of getAllProperties(self.constructor.prototype) as any) {
    if (key === 'constructor' || !filter(key)) {
      continue;
    }

    const descriptor = Reflect.getOwnPropertyDescriptor(object, key);
    if (descriptor && typeof descriptor.value === 'function') {
      (self as any)[key] = (self as any)[key].bind(self);
    }
  }

  return self;
}
