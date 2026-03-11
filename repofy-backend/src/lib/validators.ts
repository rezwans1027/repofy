/** Valid GitHub username: 1-39 alphanumeric/hyphen chars, no leading/trailing hyphen */
export const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Max number of IDs allowed in a batch delete request */
export const MAX_DELETE_IDS = 50;
