import { createMistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { z } from 'zod'


export async function getTranslation(array: string[], apiKey: string) {

  //for testing, return directly
  // return new Array(array.length).fill('').map((_, i) => `Test translated Title ${i + 1}`)  

  const  result = await generateObject({
    model: createMistral({
      apiKey: apiKey
    })("mistral-small-latest"),
    schema: z.object({
      data: z.array(z.string())
    }),
    prompt: `Translate the following titles to Chinese: ${JSON.stringify(array)}`,
  });
  return result.object.data
}
