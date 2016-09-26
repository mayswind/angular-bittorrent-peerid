'use strict';

angular.module('angularBittorrentPeerid', []);

angular.module('angularBittorrentPeerid').run(function () {
    if (typeof String.prototype.endsWith !== 'function') {
        String.prototype.endsWith = function (str) {
            return this.slice(-str.length) === str;
        }
    }

    if (typeof String.prototype.startsWith !== 'function') {
        String.prototype.startsWith = function (str, index) {
            index = index || 0;
            return this.slice(index, index + str.length) === str;
        }
    }
});

angular.module('angularBittorrentPeerid').factory('peeridUtils', function () {
    function isDigit(s) {
        var code = s.charCodeAt(0);
        return code >= '0'.charCodeAt(0) && code <= '9'.charCodeAt(0);
    }

    function isLetter(s) {
        var code = s.toLowerCase().charCodeAt(0);
        return code >= 'a'.charCodeAt(0) && code <= 'z'.charCodeAt(0);
    }

    function isAlphaNumeric(s) {
        return isDigit(s) || isLetter(s) || s === '.';
    }

    function decodeNumericValueOfByte(b, minDigits) {
        minDigits = minDigits || 0;
        var result = '' + (b & 0xff);
        while (result.length < minDigits) {
            result = '0' + result;
        }
        return result;
    }

    return {
        getUtf8Data: function (s) {
            var buffer = [];

            for (var i = 0; i < s.length; i++) {
                var ch = s.charCodeAt(i);

                if (ch < 128) {
                    buffer.push(ch);
                } else if (ch < 2048) {
                    buffer.push((ch >> 6) | 192, (ch & 63) | 128);
                } else {
                    buffer.push((ch >> 12) | 224, ((ch >> 6) & 63) | 128, (ch & 63) | 128);
                }
            }

            return buffer;
        },

        isAzStyle: function (peerId) {
            if (peerId.charAt(0) !== '-') return false;
            if (peerId.charAt(7) === '-') return true;

            /**
             * Hack for FlashGet - it doesn't use the trailing dash.
             * Also, LH-ABC has strayed into "forgetting about the delimiter" territory.
             *
             * In fact, the code to generate a peer ID for LH-ABC is based on BitTornado's,
             * yet tries to give an Az style peer ID... oh dear.
             *
             * BT Next Evolution seems to be in the same boat as well.
             *
             * KTorrent 3 appears to use a dash rather than a final character.
             */
            if (peerId.substring(1, 3) === "FG") return true;
            if (peerId.substring(1, 3) === "LH") return true;
            if (peerId.substring(1, 3) === "NE") return true;
            if (peerId.substring(1, 3) === "KT") return true;
            if (peerId.substring(1, 3) === "SP") return true;

            return false;
        },

        /**
         * Checking whether a peer ID is Shadow style or not is a bit tricky.
         *
         * The BitTornado peer ID convention code is explained here:
         *   http://forums.degreez.net/viewtopic.php?t=7070
         *
         * The main thing we are interested in is the first six characters.
         * Although the other characters are base64 characters, there's no
         * guarantee that other clients which follow that style will follow
         * that convention (though the fact that some of these clients use
         * BitTornado in the core does blur the lines a bit between what is
         * "style" and what is just common across clients).
         *
         * So if we base it on the version number information, there's another
         * problem - there isn't the use of absolute delimiters (no fixed dash
         * character, for example).
         *
         * There are various things we can do to determine how likely the peer
         * ID is to be of that style, but for now, I'll keep it to a relatively
         * simple check.
         *
         * We'll assume that no client uses the fifth version digit, so we'll
         * expect a dash. We'll also assume that no client has reached version 10
         * yet, so we expect the first two characters to be "letter,digit".
         *
         * We've seen some clients which don't appear to contain any version
         * information, so we need to allow for that.
         */
        isShadowStyle: function (peerId) {
            if (peerId.charAt(5) !== '-') return false;
            if (!isLetter(peerId.charAt(0))) return false;
            if (!(isDigit(peerId.charAt(1)) || peerId.charAt(1) === '-')) return false;

            // Find where the version number string ends.
            var lastVersionNumberIndex = 4;
            for (; lastVersionNumberIndex > 0; lastVersionNumberIndex--) {
                if (peerId.charAt(lastVersionNumberIndex) !== '-') break;
            }

            // For each digit in the version string, check if it is a valid version identifier.
            for (var i = 1; i <= lastVersionNumberIndex; i++) {
                var c = peerId.charAt(i);
                if (c === '-') return false;
                if (isAlphaNumeric(c) === null) return false;
            }

            return true;
        },

        isMainlineStyle: function (peerId) {
            /**
             * One of the following styles will be used:
             *   Mx-y-z--
             *   Mx-yy-z-
             */
            return peerId.charAt(2) === '-' && peerId.charAt(7) === '-' &&
                (peerId.charAt(4) === '-' || peerId.charAt(5) === '-');
        },

        isPossibleSpoofClient: function (peerId) {
            return peerId.endsWith('UDP0') || peerId.endsWith('HTTPBT');
        },

        decodeNumericValueOfByte: decodeNumericValueOfByte,

        getAzStyleVersionNumber: function (peerId, version) {
            if (typeof version == 'function') {
                return version(peerId);
            }
            return null;
        },

        getShadowStyleVersionNumber: function (peerId) {
            // TODO
            return null;
        },

        decodeBitSpiritClient: function (peerId, buffer) {
            if (peerId.substring(2, 4) !== 'BS') return null;
            var version = '' + buffer[1];
            if (version === '0') version = 1;

            return {
                client: "BitSpirit",
                version: version
            };
        },

        decodeBitCometClient: function (peerId, buffer) {
            var modName = "";
            if (peerId.startsWith("exbc")) modName = "";
            else if (peerId.startsWith("FUTB")) modName = "(Solidox Mod)";
            else if (peerId.startsWith("xUTB")) modName = "(Mod 2)";
            else return null;

            var isBitlord = (peerId.substring(6, 10) === "LORD");

            // Older versions of BitLord are of the form x.yy, whereas new versions (1 and onwards),
            // are of the form x.y. BitComet is of the form x.yy
            var clientName = (isBitlord) ? "BitLord" : "BitComet";
            var majVersion = decodeNumericValueOfByte(buffer[4]);
            var minVersionLength = (isBitlord && majVersion !== "0" ? 1 : 2);

            return {
                client: clientName + (modName ? " " + modName : ""),
                version: majVersion + "." + decodeNumericValueOfByte(buffer[5], minVersionLength)
            };
        },

        identifyAwkwardClient: function (peerId, buffer) {
            var firstNonZeroIndex = 20;
            var i;

            for (i = 0; i < 20; ++i) {
                if (buffer[i] > 0) {
                    firstNonZeroIndex = i;
                    break;
                }
            }

            // Shareaza check
            if (firstNonZeroIndex === 0) {
                var isShareaza = true;
                for (i = 0; i < 16; ++i) {
                    if (buffer[i] === 0) {
                        isShareaza = false;
                        break;
                    }
                }

                if (isShareaza) {
                    for (i = 16; i < 20; ++i) {
                        if (buffer[i] !== (buffer[i % 16] ^ buffer[15 - (i % 16)])) {
                            isShareaza = false;
                            break;
                        }
                    }

                    if (isShareaza) return {client: "Shareaza"};
                }
            }

            if (firstNonZeroIndex === 9 && buffer[9] === 3 && buffer[10] === 3 && buffer[11] === 3)
                return {client: "I2PSnark"};

            if (firstNonZeroIndex === 12 && buffer[12] === 97 && buffer[13] === 97)
                return {client: "Experimental", version: "3.2.1b2"};

            if (firstNonZeroIndex === 12 && buffer[12] === 0 && buffer[13] === 0)
                return {client: "Experimental", version: "3.1"};

            if (firstNonZeroIndex === 12)
                return {client: "Mainline"};

            return null;
        }
    };
});

angular.module('angularBittorrentPeerid').provider('bittorrentPeeridService', function () {
    var UNKNOWN = 'unknown';
    var FAKE = 'fake';

    // Az style two byte code identifiers to real client name
    var azStyleClients = {};
    var azStyleClientVersions = {};

    // Shadow's style one byte code identifiers to real client name
    var shadowStyleClients = {};
    var shadowStyleClientVersions = {};

    // Mainline's new style uses one byte code identifiers too
    var mainlineStyleClients = {};

    // Clients with completely custom naming schemes
    var customStyleClients = [];

    var VER_AZ_THREE_DIGITS = function (v) {
        //"1.2.3"
        return v[0] + '.' + v[1] + '.' + v[2];
    };

    var VER_AZ_DELUGE = function (v) {
        var alphabet = 'ABCDE';
        if (isNaN(v[2])) {
            return v[0] + '.' + v[1] + '.1' + (alphabet.indexOf(v[2]));
        }
        return v[0] + '.' + v[1] + '.' + v[2];
    };

    var VER_AZ_THREE_DIGITS_PLUS_MNEMONIC = function (v) {
        //"1.2.3 [4]"
        var mnemonic = v[3];
        if (mnemonic == 'B') {
            mnemonic = 'Beta';
        } else if (mnemonic == 'A') {
            mnemonic = 'Alpha';
        } else {
            mnemonic = '';
        }
        return v[0] + '.' + v[1] + '.' + v[2] + ' ' + mnemonic;
    };

    var VER_AZ_FOUR_DIGITS = function (v) {
        //"1.2.3.4"
        return v[0] + '.' + v[1] + '.' + v[2] + '.' + v[3];
    };

    var VER_AZ_TWO_MAJ_TWO_MIN = function (v) {
        //"12.34"
        return v[0] + v[1] + '.' + v[2] + v[3];
    };

    var VER_AZ_SKIP_FIRST_ONE_MAJ_TWO_MIN = function (v) {
        //"2.34"
        return v[1] + '.' + v[2] + v[3];
    };

    var VER_AZ_KTORRENT_STYLE = "1.2.3=[RD].4";

    var VER_AZ_TRANSMISSION_STYLE = function (v) {
        // "transmission"
        if (v[0] == '0' && v[1] == '0' && v[2] == '0') {
            return '0.' + v[3];
        } else if (v[0] == '0' && v[1] == '0') {
            return '0.' + v[2] + v[3];
        }
        return v[0] + '.' + v[1] + v[2] + (v[3] == 'Z' || v[3] == 'X' ? "+" : "");
    };

    var VER_AZ_WEBTORRENT_STYLE = function(v) {
        // "webtorrent"
        var version = '';
        
        if (v[0] == '0') {
            version += v[1] + '.';
        } else {
            version += '' + v[0] + v[1] + '.';
        }
        
        if (v[2] == '0') {
            version += v[3];
        } else {
            version += '' + v[2] + v[3];
        }
        
        return version;
    };

    var VER_AZ_THREE_ALPHANUMERIC_DIGITS = "2.33.4";

    var VER_NONE = "NO_VERSION";

    var addAzStyle = this.addAzStyle = function (id, client, version) {
        version = version || VER_AZ_FOUR_DIGITS;
        azStyleClients[id] = client;
        azStyleClientVersions[client] = version;
    };

    var addShadowStyle = this.addShadowStyle = function (id, client, version) {
        version = version || VER_AZ_THREE_DIGITS;
        shadowStyleClients[id] = client;
        shadowStyleClientVersions[client] = version;
    };

    var addMainlineStyle = this.addMainlineStyle = function (id, client) {
        mainlineStyleClients[id] = client;
    };

    var addSimpleClient = this.addSimpleClient = function (client, version, id, position) {
        if (typeof id === 'number' || typeof id === 'undefined') {
            position = id;
            id = version;
            version = undefined;
        }

        customStyleClients.push({
            id: id,
            client: client,
            version: version,
            position: position || 0
        });
    };

    (function () {
        addAzStyle("A~", "Ares", VER_AZ_THREE_DIGITS);
        addAzStyle("AG", "Ares", VER_AZ_THREE_DIGITS);
        addAzStyle("AN", "Ares", VER_AZ_FOUR_DIGITS);
        addAzStyle("AR", "Ares");// Ares is more likely than ArcticTorrent
        addAzStyle("AV", "Avicora");
        addAzStyle("AX", "BitPump", VER_AZ_TWO_MAJ_TWO_MIN);
        addAzStyle("AT", "Artemis");
        addAzStyle("AZ", "Vuze", VER_AZ_FOUR_DIGITS);
        addAzStyle("BB", "BitBuddy", "1.234");
        addAzStyle("BC", "BitComet", VER_AZ_SKIP_FIRST_ONE_MAJ_TWO_MIN);
        addAzStyle("BE", "BitTorrent SDK");
        addAzStyle("BF", "BitFlu", VER_NONE);
        addAzStyle("BG", "BTG", VER_AZ_FOUR_DIGITS);
        addAzStyle("bk", "BitKitten (libtorrent)");
        addAzStyle("BR", "BitRocket", "1.2(34)");
        addAzStyle("BS", "BTSlave");
        addAzStyle("BT", "BitTorrent", VER_AZ_THREE_DIGITS_PLUS_MNEMONIC);
        addAzStyle("BW", "BitWombat");
        addAzStyle("BX", "BittorrentX");
        addAzStyle("CB", "Shareaza Plus");
        addAzStyle("CD", "Enhanced CTorrent", VER_AZ_TWO_MAJ_TWO_MIN);
        addAzStyle("CT", "CTorrent", "1.2.34");
        addAzStyle("DP", "Propogate Data Client");
        addAzStyle("DE", "Deluge", VER_AZ_DELUGE);
        addAzStyle("EB", "EBit");
        addAzStyle("ES", "Electric Sheep", VER_AZ_THREE_DIGITS);
        addAzStyle("FC", "FileCroc");
        addAzStyle("FG", "FlashGet", VER_AZ_SKIP_FIRST_ONE_MAJ_TWO_MIN);
        addAzStyle("FT", "FoxTorrent/RedSwoosh");
        addAzStyle("GR", "GetRight", "1.2");
        addAzStyle("GS", "GSTorrent");// TODO: Format is v"abcd"
        addAzStyle("HL", "Halite", VER_AZ_THREE_DIGITS);
        addAzStyle("HN", "Hydranode");
        addAzStyle("KG", "KGet");
        addAzStyle("KT", "KTorrent", VER_AZ_KTORRENT_STYLE);
        addAzStyle("LC", "LeechCraft");
        addAzStyle("LH", "LH-ABC");
        addAzStyle("LK", "linkage", VER_AZ_THREE_DIGITS);
        addAzStyle("LP", "Lphant", VER_AZ_TWO_MAJ_TWO_MIN);
        addAzStyle("LT", "libtorrent (Rasterbar)", VER_AZ_THREE_ALPHANUMERIC_DIGITS);
        addAzStyle("lt", "libTorrent (Rakshasa)", VER_AZ_THREE_ALPHANUMERIC_DIGITS);
        addAzStyle("LW", "LimeWire", VER_NONE);// The "0001" bytes found after the LW commonly refers to the version of the BT protocol implemented. Documented here: http://www.limewire.org/wiki/index.php?title=BitTorrentRevision
        addAzStyle("MO", "MonoTorrent");
        addAzStyle("MP", "MooPolice", VER_AZ_THREE_DIGITS);
        addAzStyle("MR", "Miro");
        addAzStyle("MT", "MoonlightTorrent");
        addAzStyle("NE", "BT Next Evolution", VER_AZ_THREE_DIGITS);
        addAzStyle("NX", "Net Transport");
        addAzStyle("OS", "OneSwarm", VER_AZ_FOUR_DIGITS);
        addAzStyle("OT", "OmegaTorrent");
        addAzStyle("PC", "CacheLogic", "12.3-4");
        addAzStyle("PT", "Popcorn Time");
        addAzStyle("PD", "Pando");
        addAzStyle("PE", "PeerProject");
        addAzStyle("pX", "pHoeniX");
        addAzStyle("qB", "qBittorrent", VER_AZ_DELUGE);
        addAzStyle("QD", "qqdownload");
        addAzStyle("RT", "Retriever");
        addAzStyle("RZ", "RezTorrent");
        addAzStyle("S~", "Shareaza alpha/beta");
        addAzStyle("SB", "SwiftBit");
        addAzStyle("SD", "\u8FC5\u96F7\u5728\u7EBF (Xunlei)");// Apparently, the English name of the client is "Thunderbolt".
        addAzStyle("SG", "GS Torrent", VER_AZ_FOUR_DIGITS);
        addAzStyle("SN", "ShareNET");
        addAzStyle("SP", "BitSpirit", VER_AZ_THREE_DIGITS);// >= 3.6
        addAzStyle("SS", "SwarmScope");
        addAzStyle("ST", "SymTorrent", "2.34");
        addAzStyle("st", "SharkTorrent");
        addAzStyle("SZ", "Shareaza");
        addAzStyle("TN", "Torrent.NET");
        addAzStyle("TR", "Transmission", VER_AZ_TRANSMISSION_STYLE);
        addAzStyle("TS", "TorrentStorm");
        addAzStyle("TT", "TuoTu", VER_AZ_THREE_DIGITS);
        addAzStyle("UL", "uLeecher!");
        addAzStyle("UE", "\u00B5Torrent Embedded", VER_AZ_THREE_DIGITS_PLUS_MNEMONIC);
        addAzStyle("UT", "\u00B5Torrent", VER_AZ_THREE_DIGITS_PLUS_MNEMONIC);
        addAzStyle("UM", "\u00B5Torrent Mac", VER_AZ_THREE_DIGITS_PLUS_MNEMONIC);
        addAzStyle("WD", "WebTorrent Desktop", VER_AZ_WEBTORRENT_STYLE);// Go Webtorrent!! :)
        addAzStyle("WT", "Bitlet");
        addAzStyle("WW", "WebTorrent", VER_AZ_WEBTORRENT_STYLE);// Go Webtorrent!! :)
        addAzStyle("WY", "FireTorrent");// formerly Wyzo.
        addAzStyle("VG", "\u54c7\u560E (Vagaa)", VER_AZ_FOUR_DIGITS);
        addAzStyle("XL", "\u8FC5\u96F7\u5728\u7EBF (Xunlei)");// Apparently, the English name of the client is "Thunderbolt".
        addAzStyle("XT", "XanTorrent");
        addAzStyle("XF", "Xfplay", VER_AZ_TRANSMISSION_STYLE);
        addAzStyle("XX", "XTorrent", "1.2.34");
        addAzStyle("XC", "XTorrent", "1.2.34");
        addAzStyle("ZT", "ZipTorrent");
        addAzStyle("7T", "aTorrent");
        addAzStyle("ZO", "Zona", VER_AZ_FOUR_DIGITS);
        addAzStyle("#@", "Invalid PeerID");

        addShadowStyle('A', "ABC");
        addShadowStyle('O', "Osprey Permaseed");
        addShadowStyle('Q', "BTQueue");
        addShadowStyle('R', "Tribler");
        addShadowStyle('S', "Shad0w");
        addShadowStyle('T', "BitTornado");
        addShadowStyle('U', "UPnP NAT");

        addMainlineStyle('M', "Mainline");
        addMainlineStyle('Q', "Queen Bee");

        // Simple clients with no version number.
        addSimpleClient("\u00B5Torrent", "1.7.0 RC", "-UT170-");// http://forum.utorrent.com/viewtopic.php?pid=260927#p260927
        addSimpleClient("Azureus", "1", "Azureus");
        addSimpleClient("Azureus", "2.0.3.2", "Azureus", 5);
        addSimpleClient("Aria", "2", "-aria2-");
        addSimpleClient("BitTorrent Plus!", "II", "PRC.P---");
        addSimpleClient("BitTorrent Plus!", "P87.P---");
        addSimpleClient("BitTorrent Plus!", "S587Plus");
        addSimpleClient("BitTyrant (Azureus Mod)", "AZ2500BT");
        addSimpleClient("Blizzard Downloader", "BLZ");
        addSimpleClient("BTGetit", "BG", 10);
        addSimpleClient("BTugaXP", "btuga");
        addSimpleClient("BTugaXP", "BTuga", 5);
        addSimpleClient("BTugaXP", "oernu");
        addSimpleClient("Deadman Walking", "BTDWV-");
        addSimpleClient("Deadman", "Deadman Walking-");
        addSimpleClient("External Webseed", "Ext");
        addSimpleClient("G3 Torrent", "-G3");
        addSimpleClient("GreedBT", "2.7.1", "271-");
        addSimpleClient("Hurricane Electric", "arclight");
        addSimpleClient("HTTP Seed", "-WS");
        addSimpleClient("JVtorrent", "10-------");
        addSimpleClient("Limewire", "LIME");
        addSimpleClient("Martini Man", "martini");
        addSimpleClient("Pando", "Pando");
        addSimpleClient("PeerApp", "PEERAPP");
        addSimpleClient("SimpleBT", "btfans", 4);
        addSimpleClient("Swarmy", "a00---0");
        addSimpleClient("Swarmy", "a02---0");
        addSimpleClient("Teeweety", "T00---0");
        addSimpleClient("TorrentTopia", "346-");
        addSimpleClient("XanTorrent", "DansClient");
        addSimpleClient("MediaGet", "-MG1");
        addSimpleClient("MediaGet", "2.1", "-MG21");

        /**
         * This is interesting - it uses Mainline style, except uses two characters instead of one.
         * And then - the particular numbering style it uses would actually break the way we decode
         * version numbers (our code is too hardcoded to "-x-y-z--" style version numbers).
         *
         * This should really be declared as a Mainline style peer ID, but I would have to
         * make my code more generic. Not a bad thing - just something I'm not doing right
         * now.
         */
        addSimpleClient("Amazon AWS S3", "S3-");

        // Simple clients with custom version schemes
        // TODO: support custom version schemes
        addSimpleClient("BitTorrent DNA", "DNA");
        addSimpleClient("Opera", "OP");// Pre build 10000 versions
        addSimpleClient("Opera", "O");// Post build 10000 versions
        addSimpleClient("Burst!", "Mbrst");
        addSimpleClient("TurboBT", "turbobt");
        addSimpleClient("BT Protocol Daemon", "btpd");
        addSimpleClient("Plus!", "Plus");
        addSimpleClient("XBT", "XBT");
        addSimpleClient("BitsOnWheels", "-BOW");
        addSimpleClient("eXeem", "eX");
        addSimpleClient("MLdonkey", "-ML");
        addSimpleClient("Bitlet", "BitLet");
        addSimpleClient("AllPeers", "AP");
        addSimpleClient("BTuga Revolution", "BTM");
        addSimpleClient("Rufus", "RS", 2);
        addSimpleClient("BitMagnet", "BM", 2);// BitMagnet - predecessor to Rufus
        addSimpleClient("QVOD", "QVOD");
        // Top-BT is based on BitTornado, but doesn't quite stick to Shadow's naming conventions,
        // so we'll use substring matching instead.
        addSimpleClient("Top-BT", "TB");
        addSimpleClient("Tixati", "TIX");
        // seems to have a sub-version encoded in following 3 bytes, not worked out how: "folx/1.0.456.591" : 2D 464C 3130 FF862D 486263574A43585F66314D5A
        addSimpleClient("folx", "-FL");
        addSimpleClient("\u00B5Torrent Mac", "-UM");
        addSimpleClient("\u00B5Torrent", "-UT"); // UT 3.4+
    })();

    this.$get = ['peeridUtils', function (utils) {
        var getAzStyleClientName = function (peerId) {
            return azStyleClients[peerId.substring(1, 3)];
        };

        var getShadowStyleClientName = function (peerId) {
            return shadowStyleClients[peerId.substring(0, 1)];
        };

        var getMainlineStyleClientName = function (peerId) {
            return mainlineStyleClients[peerId.substring(0, 1)];
        };

        var getSimpleClient = function (peerId) {
            for (var i = 0; i < customStyleClients.length; ++i) {
                var client = customStyleClients[i];

                if (peerId.startsWith(client.id, client.position)) {
                    return client;
                }
            }

            return null;
        };

        var getAzStyleClientVersion = function (client, peerId) {
            var version = azStyleClientVersions[client];
            if (!version) return null;

            return utils.getAzStyleVersionNumber(peerId.substring(3, 7), version);
        };

        var parseClientFromPeerid = function (peerId) {
            var buffer = utils.getUtf8Data(peerId);
            var client = null;
            var version = null;
            var data = null;

            if (utils.isPossibleSpoofClient(peerId)) {
                if ((client = utils.decodeBitSpiritClient(peerId, buffer))) return client;
                if ((client = utils.decodeBitCometClient(peerId, buffer))) return client;
                return {client: "BitSpirit?"};
            }

            // See if the client uses Az style identification
            if (utils.isAzStyle(peerId)) {
                if ((client = getAzStyleClientName(peerId))) {
                    version = getAzStyleClientVersion(client, peerId);

                    // Hack for fake ZipTorrent clients - there seems to be some clients
                    // which use the same identifier, but they aren't valid ZipTorrent clients
                    if (client.startsWith("ZipTorrent") && peerId.startsWith("bLAde", 8)) {
                        return {
                            client: UNKNOWN + " [" + FAKE + ": " + name + "]",
                            version: version
                        };
                    }

                    // BitTorrent 6.0 Beta currently misidentifies itself
                    if ("\u00B5Torrent" === client && "6.0 Beta" === version) {
                        return {
                            client: "Mainline",
                            version: "6.0 Beta"
                        };
                    }

                    // If it's the rakshasa libtorrent, then it's probably rTorrent
                    if (client.startsWith("libTorrent (Rakshasa)")) {
                        return {
                            client: client + " / rTorrent*",
                            version: version
                        };
                    }

                    return {
                        client: client,
                        version: version
                    };
                }
            }

            // See if the client uses Shadow style identification
            if (utils.isShadowStyle(peerId)) {
                if ((client = getShadowStyleClientName(peerId))) {
                    // TODO: handle shadow style client version numbers
                    return {client: client};
                }
            }

            // See if the client uses Mainline style identification
            if (utils.isMainlineStyle(peerId)) {
                if ((client = getMainlineStyleClientName(peerId))) {
                    // TODO: handle mainline style client version numbers
                    return {client: client};
                }
            }

            // Check for BitSpirit / BitComet disregarding spoof mode
            if ((client = utils.decodeBitSpiritClient(peerId, buffer))) return client;
            if ((client = utils.decodeBitCometClient(peerId, buffer))) return client;

            // See if the client identifies itself using a particular substring
            if ((data = getSimpleClient(peerId))) {
                client = data.client;

                // TODO: handle simple client version numbers
                return {
                    client: client,
                    version: data.version
                };
            }

            // See if client is known to be awkward / nonstandard
            if ((client = utils.identifyAwkwardClient(peerId, buffer))) {
                return client;
            }

            // TODO: handle unknown az-formatted and shadow-formatted clients
            return {client: "unknown"};
        };

        return {
            parseClient: parseClientFromPeerid
        }
    }]
});
