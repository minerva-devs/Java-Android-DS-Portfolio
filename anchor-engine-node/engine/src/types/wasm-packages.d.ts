// Type declarations for WASM packages

declare module '@rbalchii/anchor-keyextract-wasm' {
  export function extract_keywords(text: string, max_keywords: number): string[];
}

declare module '@rbalchii/anchor-tagwalker-wasm' {
  export function search_graph(query_tags: string, atom_data: string, config_json: string): string;
}
