import { isValid } from 'zod';
import { createLogger } from '../util/logger';
import OpenAI from 'openai';

const logger = createLogger('[OpenRouter]');

export async function getTranslation(array: string[], provider: string, model: string, apiKey: string): Promise<string[]> {
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: model,
    // @ts-expect-error
      models: ['nvidia/llama-3.1-nemotron-70b-instruct:free', 'google/gemini-2.0-flash-lite-preview-02-05:free'],
      messages: [
        {
          role: 'user',
          content: `Translate the following texts to Chinese, Respond only with an array of strings.
          (e.g. ["translatedText1", "translatedText2", ...]): ${JSON.stringify(array)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "titles",
          description: "An array of translated titles",
          schema: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      }
    });
  
    logger.debug('Translation response:', completion.choices[0].message.content);

    try {
      const parsed = JSON.parse(completion.choices[0].message.content ?? '[]');
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid response format');
      }
      return parsed;
    } catch (error) {
      logger.error('Error parsing translation response:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error getting translation:', error);
    throw error;
  }
}
