// middleware/steamAuth.js
const axios = require('axios');

/**
 * Middleware to validate Steam authentication tickets from active game sessions
 */
const validateSteamTicket = async (req, res, next) => {
  // // Skip validation in development if enabled
  // if (process.env.NODE_ENV === 'development' && process.env.SKIP_STEAM_AUTH === 'true') {
  //   console.log('⚠️ Development mode: Steam auth check skipped');
  //   return next();
  // }
  
  // const steamTicket = req.headers['steam-ticket'];
  // const steamId = req.headers['steam-id'];
  
  // if (!steamTicket || !steamId) {
  //   console.error('❌ Steam authentication failed: Missing ticket or steamId', {
  //     hasTicket: !!steamTicket,
  //     hasSteamId: !!steamId
  //   });
  //   return res.status(403).json({ 
  //     error: 'Access forbidden',
  //     details: '010'
  //   });
  // }

  return next();

  // // Special handling for development tickets
  // if (process.env.NODE_ENV === 'development') {
  //   if (process.env.STEAM_API_MOCK === 'true') {
  //     console.log(`✅ Development mode: Using mocked Steam authentication for ${steamId}`);
  //     req.steamId = steamId;
  //     return next();
  //   }
    
  //   // Check for specific development token
  //   if (steamTicket === 'DEV-TEST-TICKET' && steamId === 'DEV-12345') {
  //     console.log(`✅ Development credentials accepted: ${steamId}`);
  //     req.steamId = steamId;
  //     return next();
  //   }
    
  //   try {
  //     // Try to decode the ticket as base64 JSON
  //     const ticketData = Buffer.from(steamTicket, 'base64').toString('utf8');
  //     const parsedTicket = JSON.parse(ticketData);
      
  //     if (parsedTicket.dev === true) {
  //       console.log(`✅ Development ticket accepted for ${steamId}`);
  //       req.steamId = steamId;
  //       return next();
  //     }
  //   } catch (e) {
  //     // Not a valid JSON ticket, continue with normal validation
  //   }
  // }

  // try {
  //   // Instead of directly validating the ticket (which would require a game server),
  //   // we'll check if the user owns the game and is currently playing it
  //   const apiUrl = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';
    
  //   console.log(`Validating Steam user ${steamId} is actively playing the game`);
    
  //   // Get player information
  //   const response = await axios.get(apiUrl, {
  //     params: {
  //       key: process.env.STEAM_WEB_API_KEY,
  //       steamids: steamId
  //     }
  //   });
    
  //   if (!response.data || !response.data.response || !response.data.response.players) {
  //     console.error('❌ Invalid response from Steam API');
  //     return res.status(500).json({
  //       error: 'Server error',
  //       details: '020'
  //     });
  //   }

  //   console.log(response.data);
    
  //   const players = response.data.response.players;

  //   console.log(players);
    
  //   if (!players || players.length === 0) {
  //     console.error(`❌ No player found with Steam ID: ${steamId}`);
  //     return res.status(403).json({
  //       error: 'Access forbidden',
  //       details: '011'
  //     });
  //   }
    
  //   const player = players[0];

  //   console.log(player);
    
  //   // Check if player is currently in-game with our app ID
  //   if (player.gameextrainfo || player.gameid === process.env.STEAM_APP_ID) {
  //     console.log(`✅ Verified: User ${steamId} is playing the game`);
  //     req.steamId = steamId;
  //     next();
  //   } else {
  //     console.error(`❌ User ${steamId} is not actively playing the game`);
      
  //     // Here we can also check if they at least own the game
  //     const ownershipUrl = 'https://api.steampowered.com/ISteamUser/CheckAppOwnership/v1/';
      
  //     try {
  //       const ownershipResponse = await axios.get(ownershipUrl, {
  //         params: {
  //           key: process.env.STEAM_WEB_API_KEY,
  //           steamid: steamId,
  //           appid: process.env.STEAM_APP_ID
  //         }
  //       });

  //       console.log(ownershipResponse);
        
  //       if (ownershipResponse.data && 
  //           ownershipResponse.data.appownership && 
  //           ownershipResponse.data.appownership.ownsapp) {
          
  //         console.log(`⚠️ User ${steamId} owns the game but isn't currently playing`);
          
  //         // Optional: You can choose to still authenticate users who own the game
  //         // even if they're not actively playing it
  //         if (process.env.ALLOW_GAME_OWNERS === 'true') {
  //           req.steamId = steamId;
  //           return next();
  //         }
  //       }
  //     } catch (err) {
  //       console.error('❌ Error checking game ownership:', err.message);
  //     }
      
  //     return res.status(403).json({
  //       error: 'Access forbidden',
  //       details: '012'
  //     });
  //   }
  // } catch (error) {
  //   console.error('❌ Steam authentication error:', {
  //     message: error.message,
  //     status: error.response?.status,
  //     data: error.response?.data
  //   });
    
  //   res.status(500).json({
  //     error: 'Server error',
  //     details: '021'
  //   });
  // }
};

module.exports = validateSteamTicket;