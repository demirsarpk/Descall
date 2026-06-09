/**
 * Game Socket Handlers
 * Handles blackjack and other chat games via socket
 */

const { GameManager, BlackjackGame } = require('../games/BlackjackGame');
const supabase = require('../db/supabase');

// Bot kullanıcı bilgileri (sabit ID ile)
const BOT_USER = {
  id: 'game-bot',
  username: '🎰 Casino Bot',
  avatar_url: null,
  isBot: true
};

// Komut parser regex
const COMMAND_REGEX = /^\/(\w+)(?:\s+(\S+))?/;

async function getUserCredits(userId) {
  try {
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // Kayıt yok, oluştur
      const { data: newData, error: insertError } = await supabase
        .from('user_credits')
        .insert({ user_id: userId, credits: 1000 })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newData;
    }
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[Game] Error fetching credits:', err);
    return { user_id: userId, credits: 1000, total_won: 0, total_lost: 0 };
  }
}

async function updateCredits(userId, creditsDelta, result, winAmount) {
  try {
    const { data: current } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    const newCredits = (current?.credits || 1000) + creditsDelta;
    const totalWon = (current?.total_won || 0) + (result === 'win' || result === 'blackjack' ? winAmount - (winAmount > 0 ? winAmount / 2 : 0) : 0);
    const totalLost = (current?.total_lost || 0) + (result === 'loss' ? Math.abs(creditsDelta) : 0);
    const gamesPlayed = (current?.games_played || 0) + 1;

    const { error } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits: newCredits,
        total_won: totalWon,
        total_lost: totalLost,
        games_played: gamesPlayed,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return { credits: newCredits, total_won: totalWon, total_lost: totalLost };
  } catch (err) {
    console.error('[Game] Error updating credits:', err);
    return null;
  }
}

async function saveGameHistory(userId, groupId, game, result) {
  try {
    const { error } = await supabase
      .from('game_history')
      .insert({
        user_id: userId,
        game_type: 'blackjack',
        group_id: groupId,
        bet_amount: game.bet,
        result: result,
        win_amount: game.winAmount || 0,
        player_hand: game.playerHand.toJSON(),
        dealer_hand: game.dealerHand.toJSON()
      });
    
    if (error) console.error('[Game] Error saving history:', error);
  } catch (err) {
    console.error('[Game] Error in saveGameHistory:', err);
  }
}

function createGameMessage(content, gameData = null, type = 'game_action') {
  return {
    id: `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sender: BOT_USER,
    content: content,
    type: type,
    gameData: gameData,
    created_at: new Date().toISOString(),
    timestamp: new Date().toISOString()
  };
}

function formatHand(hand, hideHoleCard = false) {
  if (hideHoleCard && hand.cards.length > 1) {
    const visible = hand.cards[0];
    return `${visible.suit}${visible.rank} 🂠`;
  }
  return hand.cards.map(c => `${c.suit}${c.rank}`).join(' ');
}

function registerGameHandlers(io, socket, state) {
  const myId = socket.user?.id;
  const myUsername = socket.user?.username;
  
  if (!myId) return;

  // Oyun komutlarını dinle (group:message üzerinden)
  socket.on('game:command', async ({ groupId, command, args }) => {
    if (!groupId || !command) return;

    const fullCommand = `/${command} ${args || ''}`.trim();
    await handleGameCommand(io, socket, myId, myUsername, groupId, fullCommand);
  });

  // Direkt oyun aksiyonları (butonlar için)
  socket.on('game:action', async ({ groupId, action, gameId }) => {
    if (!groupId || !action) return;

    await handleGameAction(io, socket, myId, groupId, action);
  });

  // Bakiye sorgulama
  socket.on('game:credits', async (callback) => {
    const credits = await getUserCredits(myId);
    if (callback) callback({ credits: credits.credits });
  });

  // Aktif oyun durumu sorgulama
  socket.on('game:status', ({ groupId }, callback) => {
    const game = GameManager.getGame(myId, groupId);
    if (callback) callback({ 
      active: !!game && game.status !== 'finished',
      game: game ? game.getState() : null
    });
  });
}

async function handleGameCommand(io, socket, userId, username, groupId, fullCommand) {
  const match = fullCommand.match(COMMAND_REGEX);
  if (!match) return;

  const [, cmd, arg] = match;
  const command = cmd.toLowerCase();

  switch (command) {
    case 'bj':
    case 'blackjack':
      await handleBlackjackStart(io, socket, userId, username, groupId, arg);
      break;
    
    case 'hit':
      await handleBlackjackAction(io, socket, userId, groupId, 'hit');
      break;
    
    case 'stand':
    case 'stay':
      await handleBlackjackAction(io, socket, userId, groupId, 'stand');
      break;
    
    case 'double':
      await handleBlackjackAction(io, socket, userId, groupId, 'double');
      break;
    
    case 'credits':
    case 'bakiye':
    case 'balance':
      await handleCreditsCheck(io, socket, userId, groupId);
      break;
    
    case 'top':
    case 'lider':
      await handleLeaderboard(io, socket, groupId);
      break;

    case 'help':
    case 'yardım':
    case 'commands':
      await handleHelp(io, socket, userId, groupId);
      break;

    case 'jb':
      // Common typo for /bj
      const typoMsg = createGameMessage(
        `🎰 **Blackjack**\n\n` +
        `❓ "/jb" yerine "/bj" mi demiştiniz?\n\n` +
        `🎯 **Başlamak için:** \`/bj <miktar>\`\n` +
        `Örnek: \`/bj 100\`\n\n` +
        `Tüm komutlar için: \`/help\``
      );
      socket.emit('game:message', { groupId, message: typoMsg });
      break;

    default:
      // Bilinmeyen komut - yardım mesajı gönder
      await handleHelp(io, socket, userId, groupId, command);
      break;
  }
}

async function handleBlackjackStart(io, socket, userId, username, groupId, betArg) {
  const bet = parseInt(betArg, 10);
  
  if (!bet || bet < 10 || bet > 10000) {
    const errorMsg = createGameMessage(
      `🎰 **Blackjack**\n\n` +
      `❌ Geçersiz bahis!\n` +
      `Kullanım: \`/bj <miktar>\`\n` +
      `Örnek: \`/bj 100\`\n\n` +
      `Min: 10 | Max: 10,000`
    );
    socket.emit('game:message', { groupId, message: errorMsg });
    socket.to(`group:${groupId}`).emit('game:message', { groupId, message: errorMsg });
    return;
  }

  // Bakiye kontrolü
  const credits = await getUserCredits(userId);
  if (credits.credits < bet) {
    const errorMsg = createGameMessage(
      `🎰 **Blackjack**\n\n` +
      `❌ Yetersiz bakiye!\n` +
      `Mevcut: **${credits.credits.toLocaleString()}** credits\n` +
      `Gerekli: **${bet.toLocaleString()}** credits`
    );
    socket.emit('game:message', { groupId, message: errorMsg });
    socket.to(`group:${groupId}`).emit('game:message', { groupId, message: errorMsg });
    return;
  }

  // Mevcut oyun kontrolü
  const existingGame = GameManager.getGame(userId, groupId);
  if (existingGame && existingGame.status !== 'finished') {
    const errorMsg = createGameMessage(
      `🎰 **Blackjack**\n\n` +
      `❌ Zaten aktif bir oyununuz var!\n` +
      `Devam etmek için: \`/hit\`, \`/stand\`, veya \`/double\``
    );
    socket.emit('game:message', { groupId, message: errorMsg });
    return;
  }

  // Oyunu başlat
  const { game, error } = GameManager.createGame(userId, groupId, bet);
  
  if (error) {
    const errorMsg = createGameMessage(`❌ ${error}`);
    socket.emit('game:message', { groupId, message: errorMsg });
    return;
  }

  // Oyun mesajını oluştur
  const isBlackjack = game.playerHand.isBlackjack;
  const isPush = game.result === 'push';
  
  let content = `🎰 **Blackjack** - @${username}\n\n`;
  content += `💰 Bahis: **${bet.toLocaleString()}** credits\n\n`;
  content += `**Senin elin:** ${formatHand(game.playerHand)} = **${game.playerHand.value}**\n`;
  content += `**Krupiye:** ${formatHand(game.dealerHand, true)}\n\n`;

  if (isBlackjack && isPush) {
    content += `🤝 **Push!** İkiniz de Blackjack!\n`;
    content += `Bahisin iade edildi: **${bet.toLocaleString()}** credits`;
  } else if (isBlackjack) {
    const winAmount = Math.floor(bet * 1.5);
    content += `🎉 **BLACKJACK!** 🎉\n`;
    content += `Kazanç: **${winAmount.toLocaleString()}** credits (+150%)`;
    
    // Bakiye güncelle
    await updateCredits(userId, winAmount, 'blackjack', winAmount);
    await saveGameHistory(userId, groupId, { bet, playerHand: game.playerHand, dealerHand: game.dealerHand, winAmount }, 'blackjack');
    GameManager.removeGame(userId, groupId);
  } else {
    content += `🎮 **Oyun Başladı!**\n\n`;
    content += `• \`/hit\` - Kart çek\n`;
    content += `• \`/stand\` - Bekle\n`;
    if (game.canDouble) {
      content += `• \`/double\` - İkiye katla (2x bet)\n`;
    }
    content += `\n⏱️ 5 dakika içinde hamle yapılmazsa oyun iptal olur.`;
  }

  const gameMsg = createGameMessage(content, game, 'game_start');
  
  socket.emit('game:message', { groupId, message: gameMsg });
  socket.to(`group:${groupId}`).emit('game:message', { groupId, message: gameMsg });
}

async function handleBlackjackAction(io, socket, userId, groupId, action) {
  const result = GameManager.action(userId, groupId, action);
  
  if (result.error) {
    const errorMsg = createGameMessage(`❌ ${result.error}`);
    socket.emit('game:message', { groupId, message: errorMsg });
    return;
  }

  const game = result.game;
  const isFinished = game.status === 'finished';
  
  let content = '';
  
  if (action === 'hit') {
    content = `🎰 **Blackjack** - Hit\n\n`;
    content += `**Senin elin:** ${game.playerHand.cards.map(c => `${c.suit}${c.rank}`).join(' ')} = **${game.playerHand.value}**\n`;
    
    if (game.playerHand.isBust) {
      content += `\n💥 **Bust!** ${game.playerHand.value} puan\n`;
      content += `Kaybettin: **${game.bet.toLocaleString()}** credits`;
    } else {
      content += `\n🎮 Devam...\n`;
      content += `• \`/hit\` - Kart çek\n`;
      content += `• \`/stand\` - Bekle`;
    }
  } else if (action === 'stand') {
    content = `🎰 **Blackjack** - Sonuç\n\n`;
    content += `**Senin elin:** ${game.playerHand.cards.map(c => `${c.suit}${c.rank}`).join(' ')} = **${game.playerHand.value}**\n`;
    content += `**Krupiye:** ${game.dealerHand.cards.map(c => `${c.suit}${c.rank}`).join(' ')} = **${game.dealerHand.value}**\n\n`;
    
    switch (game.result) {
      case 'win':
        content += `✅ **Kazandın!**\n`;
        content += `Kazanç: **${game.winAmount.toLocaleString()}** credits`;
        break;
      case 'loss':
        content += `❌ **Kaybettin!**\n`;
        content += `Kayıp: **${game.bet.toLocaleString()}** credits`;
        break;
      case 'push':
        content += `🤝 **Push!**\n`;
        content += `Bahis iade: **${game.bet.toLocaleString()}** credits`;
        break;
      case 'blackjack':
        content += `🎉 **BLACKJACK!**\n`;
        content += `Kazanç: **${game.winAmount.toLocaleString()}** credits`;
        break;
    }
  } else if (action === 'double') {
    content = `🎰 **Blackjack** - Double Down\n\n`;
    content += `Bahis ikiye katlandı: **${game.bet.toLocaleString()}** credits\n\n`;
    content += `**Senin elin:** ${game.playerHand.cards.map(c => `${c.suit}${c.rank}`).join(' ')} = **${game.playerHand.value}**\n`;
    content += `**Krupiye:** ${game.dealerHand.cards.map(c => `${c.suit}${c.rank}`).join(' ')} = **${game.dealerHand.value}**\n\n`;
    
    switch (game.result) {
      case 'win':
        content += `✅ **Kazandın!**\n`;
        content += `Kazanç: **${game.winAmount.toLocaleString()}** credits`;
        break;
      case 'loss':
        content += `❌ **Kaybettin!**\n`;
        content += `Kayıp: **${game.bet.toLocaleString()}** credits`;
        break;
      case 'push':
        content += `🤝 **Push!**\n`;
        content += `Bahis iade: **${game.bet.toLocaleString()}** credits`;
        break;
    }
  }

  const gameMsg = createGameMessage(content, game, isFinished ? 'game_end' : 'game_action');
  
  socket.emit('game:message', { groupId, message: gameMsg });
  socket.to(`group:${groupId}`).emit('game:message', { groupId, message: gameMsg });

  // Oyun bittiyse bakiye güncelle
  if (isFinished) {
    const creditsDelta = game.result === 'loss' ? -game.bet : 
                         game.result === 'push' ? 0 : 
                         game.result === 'blackjack' ? Math.floor(game.bet * 1.5) : game.bet;
    
    await updateCredits(userId, creditsDelta, game.result, game.winAmount);
    await saveGameHistory(userId, groupId, game, game.result);
    GameManager.removeGame(userId, groupId);
  }
}

async function handleCreditsCheck(io, socket, userId, groupId) {
  const credits = await getUserCredits(userId);
  
  const content = `💰 **Bakiye Bilgisi**\n\n` +
    `Mevcut Bakiye: **${credits.credits.toLocaleString()}** credits\n` +
    `Toplam Kazanç: **${(credits.total_won || 0).toLocaleString()}**\n` +
    `Toplam Kayıp: **${(credits.total_lost || 0).toLocaleString()}**\n` +
    `Oynanan Oyun: **${(credits.games_played || 0).toLocaleString()}**\n\n` +
    `🎰 Oynamak için: \`/bj <miktar>\``;

  const msg = createGameMessage(content, null, 'credits_info');
  socket.emit('game:message', { groupId, message: msg });
}

async function handleLeaderboard(io, socket, groupId) {
  try {
    const { data: topUsers, error } = await supabase
      .from('user_credits')
      .select('user_id, credits, total_won, games_played')
      .order('credits', { ascending: false })
      .limit(10);

    if (error) throw error;

    let content = `🏆 **Lider Tablosu** - Top 10\n\n`;
    
    if (!topUsers || topUsers.length === 0) {
      content += `Henüz hiç oyun oynanmamış!\n`;
      content += `İlk sen oyna: \`/bj 100\``;
    } else {
      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      
      topUsers.forEach((user, index) => {
        const medal = medals[index] || `${index + 1}.`;
        content += `${medal} <@${user.user_id}>: **${user.credits.toLocaleString()}** credits\n`;
      });
    }

    const msg = createGameMessage(content, null, 'leaderboard');
    socket.emit('game:message', { groupId, message: msg });
    socket.to(`group:${groupId}`).emit('game:message', { groupId, message: msg });
  } catch (err) {
    console.error('[Game] Leaderboard error:', err);
    const errorMsg = createGameMessage('❌ Lider tablosu yüklenirken hata oluştu.');
    socket.emit('game:message', { groupId, message: errorMsg });
  }
}

async function handleHelp(io, socket, userId, groupId, unknownCommand = null) {
  const credits = await getUserCredits(userId);
  
  let content = '🎰 **CASINO BOT - YARDIM**\n\n';

  if (unknownCommand) {
    content += `❓ Bilinmeyen komut: \`/${unknownCommand}\`\n\n`;
  }

  content += `💰 **Bakiyeniz:** ${credits.credits.toLocaleString()} credits\n\n`;

  content += '📋 **Oyun Komutları:**\n';
  content += '`/bj <miktar>` - Blackjack oyunu başlat (örn: `/bj 100`)\n';
  content += '`/hit` - Kart çek (oyundayken)\n';
  content += '`/stand` - Bekle, turu bitir (oyundayken)\n';
  content += '`/double` - Bahisi 2x yap, 1 kart çek (9-10-11 ise)\n\n';
  
  content += '📊 **Bilgi Komutları:**\n';
  content += '`/credits` - Bakiye ve istatistiklerini gör\n';
  content += '`/top` - En zengin 10 oyuncuyu gör\n';
  content += '`/help` - Bu yardım mesajını göster\n\n';
  
  content += '🎯 **Blackjack Kuralları:**\n';
  content += '• 21\'e ulaşmaya çalış, geçme (Bust)!\n';
  content += '• Krupiye 17\'ye kadar çeker\n';
  content += '• Blackjack (A+10) 3:2 öder (+150%)\n';
  content += '• Normal kazanç 1:1 öder (+100%)\n\n';
  content += '� **Başlangıç bakiyesi:** 1000 credits';

  const msg = createGameMessage(content, null, 'help');
  socket.emit('game:message', { groupId, message: msg });
  socket.to(`group:${groupId}`).emit('game:message', { groupId, message: msg });
}

// Mesaj dinleyicisi - normal group:message event'lerinden komutları yakalar
function setupMessageListener(io) {
  // Bu fonksiyon server.js'de group:message handler'ına entegre edilecek
  return async (socket, groupId, content) => {
    if (!content || typeof content !== 'string') return null;
    
    const trimmed = content.trim();
    if (!trimmed.startsWith('/')) return null;

    const match = trimmed.match(COMMAND_REGEX);
    if (!match) return null;

    const [, cmd] = match;
    const validGameCommands = ['bj', 'blackjack', 'hit', 'stand', 'stay', 'double', 'credits', 'bakiye', 'balance', 'top', 'lider', 'help', 'yardım', 'commands', 'jb'];

    if (!validGameCommands.includes(cmd.toLowerCase())) return null;

    // Bu bir oyun komutu, handle et
    await handleGameCommand(io, socket, socket.user?.id, socket.user?.username, groupId, trimmed);
    
    // Komut mesajı normal mesaj olarak gitmesin (opsiyonel)
    return { handled: true };
  };
}

module.exports = {
  registerGameHandlers,
  setupMessageListener,
  getUserCredits,
  updateCredits,
  BOT_USER,
  handleGameCommand,
  createGameMessage
};
