import { BrowserWindow, WebContentsView } from 'electron';

export class BrowserManager {
  private view: WebContentsView | null = null;
  private currentUrl: string = 'https://duckduckgo.com';
  private mainWindow: BrowserWindow | null = null;

  constructor() {}

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  public async navigate(url: string): Promise<void> {
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    this.currentUrl = target;
    if (this.view) {
      await this.view.webContents.loadURL(target);
    }
  }

  public async goBack(): Promise<void> {
    if (this.view && this.view.webContents.canGoBack()) {
      this.view.webContents.goBack();
    }
  }

  public async goForward(): Promise<void> {
    if (this.view && this.view.webContents.canGoForward()) {
      this.view.webContents.goForward();
    }
  }

  public async reload(): Promise<void> {
    if (this.view) {
      this.view.webContents.reload();
    }
  }

  public async getSnapshot(): Promise<{ url: string; title: string; text: string }> {
    if (!this.view) {
      // Fallback if view not attached: fetch text directly
      try {
        const res = await fetch(this.currentUrl);
        const html = await res.text();
        const cleanText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return {
          url: this.currentUrl,
          title: this.currentUrl,
          text: cleanText.slice(0, 50000)
        };
      } catch (e: any) {
        return {
          url: this.currentUrl,
          title: 'Error',
          text: `Failed to load page: ${e.message}`
        };
      }
    }

    const title = this.view.webContents.getTitle();
    const url = this.view.webContents.getURL();
    const text = await this.view.webContents.executeJavaScript(`
      document.body ? document.body.innerText : ''
    `);

    return {
      url,
      title,
      text: String(text || '').slice(0, 50000)
    };
  }
}
