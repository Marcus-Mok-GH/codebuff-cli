export const ChatGptConnectBanner = () => null

export async function handleChatGptAuthCode(_code: string): Promise<{
  success: boolean
  message: string
}> {
  return { success: true, message: 'ChatGPT OAuth is disabled.' }
}
