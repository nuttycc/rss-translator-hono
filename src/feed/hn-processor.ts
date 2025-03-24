import { FeedProcessor } from './processor';
import { getXMLObject, translateTitles } from '../rss/hn';

export class HNFeedProcessor implements FeedProcessor {
  constructor(private apiKey: string) {}

  async generateContent() {
    return await getXMLObject();
  }

  async translateContent(content: unknown) {
    return await translateTitles(content, this.apiKey);
  }
} 