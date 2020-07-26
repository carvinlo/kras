import { KrasRequestQuery, KrasRequest } from '../types';

function queryEquals(a: KrasRequestQuery, b: KrasRequestQuery, partiaMatch?: boolean) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);

  if (ak.length === bk.length || (partiaMatch && ak.length <= bk.length)) {
    for (const n of ak) {
      if (a[n] !== b[n]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function stringEquals(a: string, b: string) {
  return a.length === b.length && a.toUpperCase() === b.toUpperCase();
}

function pathEquals(a: string, b: string, partiaMatch?: boolean) {
  const ai = a.indexOf('?');
  const bi = b.indexOf('?');

  if (partiaMatch) {
    if (ai !== -1) {
      a = a.substr(0, ai);
    }
    if (bi !== -1) {
      b = b.substr(0, bi);
    }

    return stringEquals(a, b);
  } else if (ai === bi) {
    if (ai !== -1) {
      a = a.substr(0, ai);
      b = b.substr(0, ai);
    }

    return stringEquals(a, b);
  }

  return false;
}

export function compareRequests(a: KrasRequest, b: KrasRequest, partiaMatch?: boolean) {
  return (
    a.method === b.method &&
    (!a.target || !b.target || a.target === b.target) &&
    pathEquals(a.url, b.url, partiaMatch) &&
    queryEquals(a.query, b.query, partiaMatch)
  );
}
