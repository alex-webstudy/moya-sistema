import { TABLES, type Records } from "../src/lib/records";

export const EMPTY_RECORDS = () => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Records;
