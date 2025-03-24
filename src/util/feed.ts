import { RSSXMLString } from "../translator";
import { XMLParser } from "fast-xml-parser";
import { Feed } from "../types/feed.type";


export async function fetchFeed(feed: string): Promise<RSSXMLString> {
  
  try {
    const response = await fetch(feed, {
      headers: {
        "accept": "application/xml",
      },
    });
    const data = await response.text();
    return data;
  } catch (error) {
    console.error("🔴 Error fetching feed:", error);
    throw error;
  }
}

export function getFeedObject(xmlString: string): Feed {
  const parser = new XMLParser();
  const feed = parser.parse(xmlString);
  return feed;
}


