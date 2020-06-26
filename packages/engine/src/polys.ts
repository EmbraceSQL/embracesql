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
  const spreader = {
    // setting sets them all
    set: (target: Iterable<T>, prop: PropertyKey, value: K): boolean => {
      [...target].forEach((t) => (t[prop] = value));
      return true;
    },
    // getting gets the first item if we can
    // the assumption is you will often have parameter 'sets' of one
    get: (target: Iterable<T>, prop: PropertyKey): K => {
      // -- get at array members, like .length
      if (prop in target) return target[prop];
      // otherwise peek into the elements of the array and read the first
      const buffer = [...target];
      return buffer.length ? buffer[0][prop] : undefined;
    },
  };
  return (new Proxy<Iterable<T>>(target, spreader) as unknown) as CanBatchSet<
    T
  >;
};
