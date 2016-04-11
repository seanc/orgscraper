'use strict';

import cheerio from 'cheerio';
import request from 'cloudscraper';
import random from 'randomstring';
import zt from 'zt';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2';

const pool = mysql.createPool({
  database: 'orgscraper',
  user: 'root',
  password: 'root',
  host: '127.0.0.1'
});

const URLS = {
  index: 'http://minecraftservers.org',
  server: function(id) {
    return `http://minecraftservers.org/server/${id}`;
  },
  page: function(page) {
    return `http://minecraftservers.org/index/${page}`;
  }
};

let handleServer = function(server) {
  zt.log(`Scraping server ${server.name}`);
  request.get(URLS.server(server.id), (err, res, body) => {
    if (err) {
      return console.log(err);
    }

    console.log(body);

    let $ = cheerio.load(body);
    let serverHash = random.generate(12);

    server.banner = serverHash;
    server.bannerType = path.extname($(this).find('.server-banner').attr('src'));
    server.icon = serverHash;
    server.description = $(this).find('.desc').text();
    server.website = $(this).find('.server-info tr').get(3).find('td').get(1).find('span > a').text();
    server.votes = parseInt($(this).find('.server-info tr').get(7).find('td').get(1).find('span').text(), 10);
    server.country = $(this).find('.server-info tr').get(10).find('td').get(1).find('span > span').attr('class').split(' ')[1].trim();
    server.owner = $(this).find('.server-info tr').get(0).find('td').get(1).find('span').text().trim();

    request.get(`${URLS.index}/${$(this).find('.server-banner').attr('src')}`, (err, res, body) => {
      if (err) {
        return console.log(err);
      }

      let ext = path.extname($(this).find('.server-banner').attr('src'));

      fs.writeFile(`banners/${serverHash}.${ext}`, body, err => {
        if (err) {
          return console.log(err);
        }
      });
    });

    request.get(`https://us.mc-api.net/v3/server/favicon/${server.ip}:${server.port}`, (err, res, body) => {
      if (err) {
        return console.log(err);
      }

      fs.writeFile(`icons/${serverHash}.png`, body, err => {
        if (err) {
          return console.log(err);
        }
      });
    });

    zt.log(`Getting ready to insert ${server.name}`);
    pool.execute('INSERT INTO `server` WHERE VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        null,
        server.name,
        server.description,
        null,
        server.ip,
        server.port,
        null,
        server.website,
        server.banner,
        server.bannerType,
        server.votes,
        server.score,
        server.country,
        null,
        server.status,
        server.playersOnline,
        server.playersMax,
        null,
        null,
        null,
        server.owner,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ], err => {
        if (err) {
          return console.log(err);
        }

        zt.log(`Added server ${server.name}`);
      });
  });
};

let handlePages = function(err, res, body) {
  if (err) {
    return console.log(err);
  }

  let $ = cheerio.load(body);

  $('.serverlist > tbody > tr').each(function() {
    if ($(this).find('.col-rank').find('.sponsored').length === 0) {
      let players = $(this).find('.col-players > .count').text().split('/');
      let server = {
        id: $(this).attr('data-id'),
        score: parseInt($(this).find('.col-rank > .ranking').text().trim(), 10),
        name: $(this).find('.col-name > .server-name > a').text().trim(),
        banner: '',
        ip: $(this).find('.col-server > .server-ip > p').text().trim().split(':')[0],
        port: 25565,
        playersOnline: players[0],
        playersMax: players[1],
        status: $('.col-status > .tag').text()
      };

      if ($(this).find('.col-server > .server-ip > p').text().trim().split(':').length > 0) {
        server.port = $('.col-server > .server-ip > p').text().trim().split(':')[1];
      }

      handleServer(server);
    }
  });
};

zt.log('Starting scraping process...');
request.get(URLS.index, (err, res, body) => {
  if (err) {
    return console.log(err);
  }

  let $ = cheerio.load(body);

  let serverCount = parseInt($('.tracker > p').text().replace(/(.*Tracking\s+)(.*)(\s+servers.*)/, '$2').replace(',', ''), 10);
  zt.log(`Found ${serverCount} servers...`);

  for (let i = 0; i < serverCount; i++) {
    request.get(URLS.page(i), handlePages);
  }

  // $('.serverlist > tbody > tr').each(function() {
  //   console.log($(this).attr('data-id'));
  // });
});
