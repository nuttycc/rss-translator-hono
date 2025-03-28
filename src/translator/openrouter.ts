import { createLogger } from '../util/logger';
import OpenAI from 'openai';

const logger = createLogger('[OpenRouter]');

export async function getTranslation(array: string[], provider: string, model: string, apiKey: string) {
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: `Translate the following titles to Chinese, Respond with an array of strings(JSON): ${JSON.stringify(array)}`,
        },
      ],
    });
  
    logger.debug('Translation response:', completion.choices[0].message.content);
    return completion.choices[0].message.content ?? [];
  } catch (error) {
    logger.error('Error getting translation:', error);
    throw error;
  }
}
