const typedObjectKeys = Object.keys as <T>(
  o: T
) => (Extract<keyof T, string>)[];

export type KeyValidator<ObjectType> = {
  [T in keyof ObjectType]: Validator<ObjectType[T]>[]
};

export type KeyValidatorResult<Object> = {
  [P in keyof Object]:
    | ValidatorResult<Object[P]>
    | Promise<ValidatorResult<Object[P]>>
};

export type ValidatorResult<Value> = {
  valid: boolean;
  errors: string[];
  keys?: KeyValidatorResult<Value>;
  items?: ValidatorResult<Value>[];
};

export interface Validator<ValueType> {
  (value: ValueType): ValidatorResult<ValueType>;
}

export type ValidationContext<ObjectType> = { model: ObjectType };

export type ValidatorChain<ValueType> = Validator<ValueType>[];

export function validateChain<ValueType>(
  value: ValueType,
  chain: Validator<ValueType>[],
  currentIndex = 0,
  errors = []
): ValidatorResult<ValueType> | Promise<ValidatorResult<ValueType>> {
  if (currentIndex >= chain.length) {
    return { valid: true, errors };
  }
  const validationResult = chain[currentIndex](value);
  function recurseOrBreak(result: ValidatorResult<ValueType>) {
    return result.errors.length > 0
      ? validateChain(value, chain, currentIndex + 1)
      : result;
  }
  return validationResult instanceof Promise
    ? validationResult.then(recurseOrBreak)
    : recurseOrBreak(validationResult);
}

function assignKeyResult<ObjectType, Key extends keyof ObjectType>(
  key: Key,
  value: KeyValidatorResult<ObjectType>,
  result: ValidatorResult<ObjectType[Key]>
): KeyValidatorResult<ObjectType> {
  value[key] = result;
  return value;
}

function assignMaybeAsyncKeyResult<ObjectType, Key extends keyof ObjectType>(
  key: Key,
  value: KeyValidatorResult<ObjectType>,
  result:
    | ValidatorResult<ObjectType[Key]>
    | Promise<ValidatorResult<ObjectType[Key]>>
): KeyValidatorResult<ObjectType> | Promise<KeyValidatorResult<ObjectType>> {
  const resolver = (result: ValidatorResult<ObjectType[Key]>) =>
    assignKeyResult(key, value, result);
  return result instanceof Promise ? result.then(resolver) : resolver(result);
}

export const validateItems = <ItemType, ObjectType extends ItemType[]>(validators: Validator<ItemType>[]) => (
  items: ObjectType
) => {
  items.reduce((acc, item) => {
      return acc;
  }, {
    valid: true,
    errors: [],
  } as ValidatorResult<ObjectType>);
};

export const validateKeys = <ObjectType>(
  keyValidators: KeyValidator<ObjectType>
) => (
  value: ObjectType
): KeyValidatorResult<ObjectType> | Promise<KeyValidatorResult<ObjectType>> =>
  typedObjectKeys(keyValidators).reduce(
    (acc, key) => {
      const result = validateChain(value[key], keyValidators[key]);
      return acc instanceof Promise
        ? acc.then(asyncAcc => assignMaybeAsyncKeyResult(key, asyncAcc, result))
        : assignMaybeAsyncKeyResult(key, acc, result);
    },
    {} as
      | KeyValidatorResult<ObjectType>
      | Promise<KeyValidatorResult<ObjectType>>
  );
