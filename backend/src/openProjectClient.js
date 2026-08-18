import axios from 'axios';
import { config } from './config.js';

export const opClient = axios.create({
  baseURL: `${config.openProjectUrl}/api/v3`,
  auth: {
    username: 'apikey',
    password: config.openProjectApiKey,
  },
  headers: {
    Accept: 'application/hal+json',
  },
});

opClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    const wrapped = new Error(`OpenProject API error${status ? ` (${status})` : ''}: ${message}`);
    wrapped.status = status;
    wrapped.cause = error;
    return Promise.reject(wrapped);
  }
);

/**
 * Fetches every page of an OpenProject HAL collection endpoint.
 * OpenProject paginates with a 1-based page number ("offset") and a page size.
 */
export async function fetchAllPages(path, { filters, pageSize = 200, ...extraParams } = {}) {
  const elements = [];
  let offset = 1;

  for (;;) {
    const params = { offset, pageSize, ...extraParams };
    if (filters) params.filters = JSON.stringify(filters);

    const { data } = await opClient.get(path, { params });
    const pageElements = data._embedded?.elements ?? [];
    elements.push(...pageElements);

    const total = data.total ?? elements.length;
    if (elements.length >= total || pageElements.length < pageSize) break;
    offset += 1;
  }

  return elements;
}
