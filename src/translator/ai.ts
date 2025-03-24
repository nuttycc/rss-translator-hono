import { createMistral } from "@ai-sdk/mistral";
import { createCohere } from "@ai-sdk/cohere";
import { generateObject } from "ai";
import { z } from 'zod'


export async function getTranslation(array: string[], provider: string, model: string, apiKey: string) {

  //for testing, return directly
  // return new Array(array.length).fill('').map((_, i) => `Test translated Title ${i + 1}`)  

  let modelInstance;

  switch (provider) {
    case "mistral":
      modelInstance = createMistral({
        apiKey: apiKey
      })(model)
      break
    case "cohere":
      modelInstance = createCohere({
        apiKey: apiKey
      })(model)
      break
    default:
      throw new Error(`Provider ${provider} not supported`)
  }



  const  result = await generateObject({
    model: modelInstance,
    schema: z.object({
      data: z.array(z.string())
    }),
    prompt: `Translate the following titles to Chinese: ${JSON.stringify(array)}`,
  });
  return result.object.data
}
