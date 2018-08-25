# angular-bittorrent-peerid

![NPM](https://img.shields.io/npm/v/angular-bittorrent-peerid.svg)

A native AngularJS implement for [bittorrent-peerid](https://github.com/fisch0920/bittorrent-peerid).

## Install

### Using bower
    bower install angular-bittorrent-peerid --save

## Usage
    angular.module('yourApp', ['angularBittorrentPeerid'])
        .controller('yourController', function (bittorrentPeeridService) {
            var peerId = '...';
            var client = bittorrentPeeridService.parseClient(peerId);
            
            var clientName = client.client;
            var clientVersion = client.version;
        });

## License
[MIT](https://github.com/mayswind/angular-bittorrent-peerid/blob/master/LICENSE)
