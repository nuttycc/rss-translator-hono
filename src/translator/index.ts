import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { getTranslation } from "./mistral";
import { createLogger } from "../util/logger";

const logger = createLogger('[Translator]');

export type RSSXMLString = string;

export function translateTitles(
  titles: string[],
  provider: string,
  apiKey: string
) {

  if (!provider || !apiKey) {
    logger.error('Provider or API key not provided');
    throw new Error('Provider or API key not provided');
  }

  logger.debug(`Translating titles with provider: ${provider}`);
  switch (provider) {
    case "mistral":
      logger.debug("Using Mistral for translation");
      return getTranslation(titles, apiKey);
    default:
      logger.error(`Provider ${provider} not supported`);
      throw new Error(`Provider ${provider} not supported`);
  }
}

export async function translateFeedTitles(xmlString: RSSXMLString, provider: string, apiKey: string): Promise<RSSXMLString> {
  logger.log('Translating feed titles');
  logger.debug(`XML string length: ${xmlString.length}`);
  try {
    logger.debug('Parsing XML string');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true
    });
    const feed = parser.parse(xmlString);

    logger.debug('Feed parsed', feed);

    // Find the channel element
    logger.debug('Finding the channel element');
    const channelElement = feed.find((element: any) => element.rss)?.rss.find((element: any) => element.channel)?.channel;
    
    if (!channelElement) {
      logger.error('Invalid feed structure: channel not found');
      throw new Error('Invalid feed structure: channel not found');
    }

    // Find the items in the channel
    logger.debug('Finding the items in the channel');
    const itemElements = channelElement.filter((element: any) => element.item);
    
    if (!itemElements || itemElements.length === 0) {
      logger.error('Invalid feed structure: items not found');
      throw new Error('Invalid feed structure: items not found');
    }

    // Extract titles
    logger.debug('Extracting titles');
    const titles: string[] = [];
    itemElements.forEach((itemWrapper: any) => {
      const titleElement = itemWrapper.item.find((element: any) => element.title);
      if (titleElement && titleElement.title) {
        titles.push(titleElement.title[0]?.["#text"] || titleElement.title[0]);
      }
    });

    logger.debug(`Extracted titles: ${titles.length}`);
    const translatedTitles = await translateTitles(titles, provider, apiKey);
    
    // Replace titles with translated ones
    logger.debug('Replacing titles with translated ones');
    let titleIndex = 0;
    itemElements.forEach((itemWrapper: any) => {
      const titleElement = itemWrapper.item.find((element: any) => element.title);
      if (titleElement && titleElement.title && titleIndex < translatedTitles.length) {
        if (typeof titleElement.title[0] === 'object' && "#text" in titleElement.title[0]) {
          titleElement.title[0]["#text"] = translatedTitles[titleIndex];
        } else {
          titleElement.title[0] = translatedTitles[titleIndex];
        }
        titleIndex++;
      }
    });
    
    logger.debug('Building XML');
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      preserveOrder: true,
      format: true
    });
    const result = builder.build(feed);
    logger.debug('XML built successfully');
    return result;
  } catch (error) {
    logger.error("Error translating feed titles:", error);
    throw error;
  }
}