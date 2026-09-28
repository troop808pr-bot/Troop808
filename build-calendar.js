const fs = require('fs');

const calIds = {
    tropa: "troop808pr@gmail.com",
    oa: "7803ec765a89e88d9dc72ef1a267b6d4e1b75a32c4cf00820af8bffb5bac2d6f@group.calendar.google.com",
    distrito: "887a472df723b4721b7c9f23649439b2b73bc64a94eb40d4c1e776df955977ba@group.calendar.google.com"
};

const calendars = [
    { id: calIds.tropa, source: 'tropa' },
    { id: calIds.oa, source: 'oa' },
    { id: calIds.distrito, source: 'distrito' }
];

const pad = n => String(n).padStart(2, '0');
const formatLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

const parseIcsDateForPR = (str) => {
    if (!str.includes('T')) {
        const y = parseInt(str.substring(0, 4), 10), m = parseInt(str.substring(4, 6), 10) - 1, d = parseInt(str.substring(6, 8), 10);
        return new Date(y, m, d);
    }
    const isUTC = str.endsWith('Z');
    let y = parseInt(str.substring(0, 4), 10), m = parseInt(str.substring(4, 6), 10) - 1, d = parseInt(str.substring(6, 8), 10);
    let h = parseInt(str.substring(9, 11), 10), min = parseInt(str.substring(11, 13), 10);
    
    if (isUTC) {
        const dObj = new Date(Date.UTC(y, m, d, h, min, 0));
        const prTimeMs = dObj.getTime() - (4 * 60 * 60 * 1000); // UTC-4 AST
        const prDate = new Date(prTimeMs);
        return new Date(prDate.getUTCFullYear(), prDate.getUTCMonth(), prDate.getUTCDate(), prDate.getUTCHours(), prDate.getUTCMinutes(), 0);
    } else {
        return new Date(y, m, d, h, min, 0);
    }
};

async function buildCalendar() {
    console.log("Iniciando descarga de calendarios...");
    let allEvents = [];

    for (const cal of calendars) {
        try {
            const encodedId = encodeURIComponent(cal.id);
            const iCalUrl = `https://calendar.google.com/calendar/ical/${encodedId}/public/basic.ics`;
            
            const response = await fetch(iCalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            
            if (!response.ok) {
                console.error(`Error obteniendo ${cal.source}: Status ${response.status}`);
                continue;
            }
            
            const rawICal = await response.text();
            const unfolded = rawICal.replace(/\r?\n[ \t]/g, "");
            const vevents = unfolded.split('BEGIN:VEVENT').slice(1);

            const events = vevents.map(v => {
                const s = v.match(/SUMMARY:(.*)/);
                const stMatch = v.match(/DTSTART(?:;[^:]*)?:([0-9]{8}(?:T[0-9]{6}Z?)?)/);
                const endMatch = v.match(/DTEND(?:;[^:]*)?:([0-9]{8}(?:T[0-9]{6}Z?)?)/);
                const locMatch = v.match(/LOCATION:(.*)/);
                const descMatch = v.match(/DESCRIPTION:(.*)/);

                if (!stMatch) return null;

                const dateStr = stMatch[1]; 
                let eventDate = parseIcsDateForPR(dateStr);
                let endDate = endMatch ? parseIcsDateForPR(endMatch[1]) : null;

                let startStr = !dateStr.includes('T') ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}` : formatLocalISO(eventDate);
                let endStr = null;
                
                if (endDate && endMatch) {
                    endStr = !endMatch[1].includes('T') ? `${endMatch[1].substring(0, 4)}-${endMatch[1].substring(4, 6)}-${endMatch[1].substring(6, 8)}` : formatLocalISO(endDate);
                }

                let calBgColor = '#4c1d95'; 
                const summaryLower = s ? s[1].toLowerCase() : "";
                
                if (cal.source === 'oa') calBgColor = '#dc2626';
                else if (cal.source === 'distrito') calBgColor = '#2563eb';
                else {
                    if (summaryLower.includes('verde')) calBgColor = '#16a34a';
                    else if (summaryLower.includes('naranja')) calBgColor = '#ea580c';
                    else if (summaryLower.includes('azul')) calBgColor = '#2563eb';
                    else if (summaryLower.includes('rojo') || summaryLower.includes('roja')) calBgColor = '#dc2626';
                }

                let cleanDesc = descMatch ? descMatch[1].trim() : "";
                cleanDesc = cleanDesc.replace(/\\n/g, '<br>').replace(/\\,/g, ',').replace(/\\;/g, ';');

                return { 
                    title: s ? s[1].trim() : "Evento", 
                    source: cal.source,
                    start: startStr, 
                    end: endStr,
                    allDay: !dateStr.includes('T'),
                    y: eventDate.getFullYear(), 
                    m: eventDate.getMonth(), 
                    d: eventDate.getDate(), 
                    comp: eventDate.getTime(),
                    backgroundColor: calBgColor,
                    borderColor: 'transparent',
                    extendedProps: {
                        location: locMatch ? locMatch[1].trim() : "",
                        description: cleanDesc
                    }
                };
            }).filter(e => e !== null);

            allEvents = allEvents.concat(events);
        } catch (err) {
            console.error(`Error procesando calendario ${cal.source}:`, err);
        }
    }

    allEvents.sort((a, b) => a.comp - b.comp);

    fs.writeFileSync('events.json', JSON.stringify(allEvents, null, 2));
    console.log(`¡Éxito! Se generó events.json con ${allEvents.length} eventos.`);
}

buildCalendar();
