export async function sha256BookId(bytes: Uint8Array): Promise<string> {
  const source = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest('SHA-256', source)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

