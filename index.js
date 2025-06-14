#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');
const { program } = require('commander');
const fs = require('fs');

// تكوين الأداة
program
  .version('1.0.0')
  .option('-d, --dork <dork>', 'SQL injection dork للبحث')
  .option('-e, --engine <engine>', 'محرك البحث (google/bing)', 'google')
  .option('-o, --output <file>', 'ملف حفظ النتائج', 'results.txt')
  .parse(process.argv);

const options = program.opts();

// دوال البحث في محركات البحث
async function searchGoogle(dork) {
  try {
    const response = await axios.get(`https://www.google.com/search?q=${encodeURIComponent(dork)}`);
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('div.g').each((i, element) => {
      const title = $(element).find('h3').text();
      const url = $(element).find('a').attr('href');
      if (url && !url.includes('google.com')) {
        results.push({ title, url: url.startsWith('/url?q=') ? url.slice(7) : url });
      }
    });
    
    return results;
  } catch (error) {
    console.error(chalk.red('خطأ في البحث:', error.message));
    return [];
  }
}

async function searchBing(dork) {
  try {
    const response = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(dork)}`);
    const $ = cheerio.load(response.data);
    const results = [];
    
    $('.b_algo').each((i, element) => {
      const title = $(element).find('h2').text();
      const url = $(element).find('a').attr('href');
      if (url) {
        results.push({ title, url });
      }
    });
    
    return results;
  } catch (error) {
    console.error(chalk.red('خطأ في البحث:', error.message));
    return [];
  }
}

// دالة تحليل الموقع للبحث عن ثغرات SQL
async function analyzeSite(url) {
  try {
    const response = await axios.get(url);
    const vulnerabilities = [];
    
    // فحص الاستجابة للبحث عن علامات ثغرات SQL
    const errorPatterns = [
      'SQL syntax',
      'mysql_fetch_array',
      'You have an error in your SQL syntax',
      'Warning: mysql',
      'unclosed quotation mark after the character string',
      'quoted string not properly terminated'
    ];
    
    errorPatterns.forEach(pattern => {
      if (response.data.toLowerCase().includes(pattern.toLowerCase())) {
        vulnerabilities.push(`تم العثور على نمط الثغرة: ${pattern}`);
      }
    });
    
    return vulnerabilities;
  } catch (error) {
    return [`خطأ في تحليل الموقع: ${error.message}`];
  }
}

// الدالة الرئيسية
async function main() {
  if (!options.dork) {
    console.error(chalk.red('يرجى تحديد dork للبحث'));
    process.exit(1);
  }

  console.log(chalk.blue('بدء البحث عن المواقع المصابة...'));
  
  const searchResults = await (options.engine === 'google' ? searchGoogle(options.dork) : searchBing(options.dork));
  const output = [];

  console.log(chalk.green(`تم العثور على ${searchResults.length} موقع`));

  for (const result of searchResults) {
    console.log(chalk.yellow('\nتحليل الموقع:', result.url));
    const vulnerabilities = await analyzeSite(result.url);
    
    if (vulnerabilities.length > 0) {
      const siteResult = `\nالموقع: ${result.url}\nالثغرات المكتشفة:\n${vulnerabilities.join('\n')}`;
      console.log(chalk.red(siteResult));
      output.push(siteResult);
    }
  }

  // حفظ النتائج في ملف
  fs.writeFileSync(options.output, output.join('\n\n'));
  console.log(chalk.green(`\nتم حفظ النتائج في الملف: ${options.output}`));
}

main().catch(error => {
  console.error(chalk.red('خطأ:', error.message));
  process.exit(1);
});