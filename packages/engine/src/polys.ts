/* eslint-disable @typescript-eslint/ban-types */
import { CanBatchSet } from "./shared-context";

/**
 * Not sure this is the best name -- but I'm calling them Polys.
 *
 * What's a poly -- it's an array or a scalar, with some convenience
 * to be able to scalar set 'all' of the array member, or get the first
 * member as is a common case when you want to ignore the fact that
 * parameters can be an array/batch.
 *
 */
export const polyArray = <T extends object, K>(
  target: Iterable<T>
): CanBatchSet<T> => {
  const valueBuffer = {};
  const spreader = {
    // setting sets them all, and on the root so we can be both an
    // array and a value
    set: (target: Iterable<T>, prop: PropertyKey, value: K): boolean => {
      // stash a scalar
      valueBuffer[prop] = value;
      // spread the array
      [...target].forEach((t) => (t[prop] = value));
      return true;
    },
    // getting gets the first item if we can
    // the assumption is you will often have parameter 'sets' of one
    get: (target: Iterable<T>, prop: PropertyKey): K => {
      // -- get at array members, like .length
      if (prop in target) return target[prop];
      // promise trap -- I'm a value, not a promise
      if (prop === "then") return null;
      // otherwise peek into the elements of the array and read the first
      const array = [...target];
      // look at the first element of the array, or failing that -- in the buffer
      const fromArray = array.length ? array[0][prop] : undefined;
      // but try really hard and if we didn't have array parameters, look in the
      // root scalar stash
      return fromArray || valueBuffer[prop];
    },
  };
  return (new Proxy<Iterable<T>>(target, spreader) as unknown) as CanBatchSet<
    T
  >;
};
