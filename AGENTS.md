# Architecture
- Claim recoveries through one database RPC that locks the streak row and writes the history in the same transaction, preventing unlogged or duplicate deductions.
- Keep the legacy freeze_count and recovery availability columns synchronized in database setup so existing timer completion and its sanitizer remain unchanged.
- External-database setup SQL is user-applied; never apply it to the unrelated managed Cloud database.