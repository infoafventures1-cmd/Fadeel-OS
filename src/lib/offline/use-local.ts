"use client";

import { useState } from "react";

/**
 * Local state that starts from a server value and keeps the person's change, even when the change was stored
 * offline and the server hasn't confirmed it yet. A new value from the server (after a refresh) replaces it.
 */
export function useLocal<T>(server: T) {
  const [value, setValue] = useState(server);
  const [prev, setPrev] = useState(server);
  if (!Object.is(server, prev)) {
    setPrev(server);
    setValue(server);
  }
  return [value, setValue] as const;
}
