const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');
const logger = require('../../utils/logger');

class TemplateService {
  constructor() {
    this.templateDir = path.join(__dirname, '../../../templates/email');
    this.cache = new Map();
  }

  async loadTemplate(templatePath) {
    if (this.cache.has(templatePath)) {
      return this.cache.get(templatePath);
    }

    try {
      const fullPath = path.join(this.templateDir, templatePath);
      const templateContent = await fs.readFile(fullPath, 'utf-8');
      const template = handlebars.compile(templateContent);
      this.cache.set(templatePath, template);
      return template;
    } catch (error) {
      logger.error(`Failed to load template ${templatePath}:`, error);
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  async render(templatePath, data) {
    const template = await this.loadTemplate(templatePath);
    return template(data);
  }

  clearCache() {
    this.cache.clear();
  }
}

handlebars.registerHelper('image_tag', function(src, options) {
  const alt = options.hash.alt || '';
  const className = options.hash.class || '';
  return `<img src="${src}" alt="${alt}" class="${className}" />`;
});

module.exports = new TemplateService();

