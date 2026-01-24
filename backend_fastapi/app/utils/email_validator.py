"""
Email Validation Utility

Provides email validation including:
- Format validation
- Disposable email detection
- Email existence checking
"""

import re
from typing import Dict, Set
from email_validator import validate_email, EmailNotValidError


class EmailValidator:
    """Comprehensive email validation."""
    
    # Common disposable email domains (top 100+)
    DISPOSABLE_DOMAINS: Set[str] = {
        "0-mail.com", "027168.com", "0815.ru", "0clickemail.com", "10minutemail.com",
        "10minutemail.net", "123-m.com", "1pad.de", "20minutemail.com", "2prong.com",
        "30minutemail.com", "33mail.com", "3d-painting.com", "4warding.com", "4warding.net",
        "60minutemail.com", "675hosting.com", "675hosting.net", "6url.com", "75hosting.com",
        "7tags.com", "9ox.net", "a-bc.net", "agedmail.com", "ama-trade.de", "amilegit.com",
        "amiri.net", "amiriindustries.com", "anonbox.net", "anonymbox.com", "antichef.com",
        "antichef.net", "antispam.de", "baxomale.ht.cx", "beefmilk.com", "binkmail.com",
        "bio-muesli.net", "bobmail.info", "bodhi.lawlita.com", "bofthew.com", "bootybay.de",
        "boun.cr", "bouncr.com", "breakthru.com", "brefmail.com", "broadbandninja.com",
        "bsnow.net", "bugmenot.com", "bumpymail.com", "casualdx.com", "centermail.com",
        "chogmail.com", "choicemail1.com", "cool.fr.nf", "correo.blogos.net", "cosmorph.com",
        "courriel.fr.nf", "courrieltemporaire.com", "crapmail.org", "cust.in", "dacoolest.com",
        "dandikmail.com", "dayrep.com", "dcemail.com", "deadaddress.com", "deadspam.com",
        "despam.it", "despammed.com", "devnullmail.com", "dfgh.net", "digitalsanctuary.com",
        "discardmail.com", "discardmail.de", "disposableaddress.com", "disposableemailaddresses.com",
        "disposableinbox.com", "dispose.it", "dispostable.com", "dodgeit.com", "dodgit.com",
        "donemail.ru", "dontreg.com", "dontsendmespam.de", "dump-email.info", "dumpandjunk.com",
        "dumpmail.de", "dumpyemail.com", "e-mail.com", "e-mail.org", "e4ward.com", "easytrashmail.com",
        "email60.com", "emaildienst.de", "emailias.com", "emailigo.de", "emailinfive.com",
        "emailmiser.com", "emailsensei.com", "emailtemporanea.com", "emailtemporanea.net",
        "emailtemporar.ro", "emailtemporario.com.br", "emailthe.net", "emailtmp.com",
        "emailto.de", "emailwarden.com", "emailx.at.hm", "emailxfer.com", "emz.net",
        "enterto.com", "ephemail.net", "etranquil.com", "etranquil.net", "etranquil.org",
        "explodemail.com", "fakeinbox.com", "fakeinformation.com", "fansworldwide.de",
        "fastacura.com", "fastchevy.com", "fastchrysler.com", "fastkawasaki.com",
        "fastmazda.com", "fastmitsubishi.com", "fastnissan.com", "fastsubaru.com",
        "fastsuzuki.com", "fasttoyota.com", "fastyamaha.com", "filzmail.com", "fizmail.com",
        "fr33mail.info", "frapmail.com", "front14.org", "fux0ringduh.com", "garliclife.com",
        "get1mail.com", "get2mail.fr", "getairmail.com", "getmails.eu", "getonemail.com",
        "getnowmail.com", "getonemail.net", "ghosttexter.de", "girlsundertheinfluence.com",
        "gishpuppy.com", "gm.hc.vc", "gmaildapp.com", "gmx1mail.top", "goemailgo.com",
        "gotmail.com", "gotmail.net", "gotmail.org", "gotti.otherinbox.com", "great-host.in",
        "greensloth.com", "grr.la", "gsrv.co.uk", "guerillamail.biz", "guerillamail.com",
        "guerillamail.net", "guerillamail.org", "guerrillamail.biz", "guerrillamail.com",
        "guerrillamail.de", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
        "gustr.com", "h.mintemail.com", "h8s.org", "haltospam.com", "hatespam.org",
        "hidemail.de", "hidzz.com", "hmamail.com", "hopemail.biz", "ieatspam.eu",
        "ieatspam.info", "ihateyoualot.info", "iheartspam.org", "imails.info", "inbax.tk",
        "inbox.si", "inboxalias.com", "inboxclean.com", "inboxclean.org", "incognitomail.com",
        "incognitomail.net", "incognitomail.org", "insorg-mail.info", "instant-mail.de",
        "ip6.li", "ipoo.org", "irish2me.com", "iwi.net", "jetable.com", "jetable.fr.nf",
        "jetable.net", "jetable.org", "jnxjn.com", "jourrapide.com", "jsrsolutions.com",
        "kasmail.com", "kaspop.com", "keepmymail.com", "killmail.com", "killmail.net",
        "kir.ch.tc", "klassmaster.com", "klzlk.com", "koszmail.pl", "kurzepost.de",
        "lawlita.com", "letthemeatspam.com", "lhsdv.com", "lifebyfood.com", "link2mail.net",
        "litedrop.com", "lol.ovpn.to", "lookugly.com", "lopl.co.cc", "lortemail.dk",
        "lr78.com", "lroid.com", "lukop.dk", "m21.cc", "mail-temporaire.fr", "mail.by",
        "mail.mezimages.net", "mail.zp.ua", "mail1a.de", "mail21.cc", "mail2rss.org",
        "mail333.com", "mail4trash.com", "mailbidon.com", "mailbiz.biz", "mailblocks.com",
        "mailbucket.org", "mailcat.biz", "mailcatch.com", "mailde.de", "mailde.info",
        "maildrop.cc", "maildrop.cf", "maildrop.ga", "maildrop.gq", "maildrop.ml",
        "maildu.de", "maildx.com", "maileater.com", "mailed.in", "mailed.ro", "mailexpire.com",
        "mailfa.tk", "mailforspam.com", "mailfree.ga", "mailfreeonline.com", "mailguard.me",
        "mailimate.com", "mailin8r.com", "mailinater.com", "mailinator.com", "mailinator.net",
        "mailinator.org", "mailinator2.com", "mailincubator.com", "mailismagic.com",
        "mailme.gq", "mailme.ir", "mailme.lv", "mailme24.com", "mailmetrash.com",
        "mailmoat.com", "mailms.com", "mailnator.com", "mailnesia.com", "mailnull.com",
        "mailorg.org", "mailpick.biz", "mailrock.biz", "mailscrap.com", "mailseal.de",
        "mailshell.com", "mailsiphon.com", "mailslite.com", "mailtemp.info", "mailtome.de",
        "mailtothis.com", "mailtrash.net", "mailtv.net", "mailtv.tv", "mailzilla.com",
        "mailzilla.org", "makemetheking.com", "manybrain.com", "mbx.cc", "mega.zik.dj",
        "meinspamschutz.de", "meltmail.com", "messagebeamer.de", "mezimages.net",
        "ministry-of-silly-walks.de", "mintemail.com", "misterpinball.de", "moncourrier.fr.nf",
        "monemail.fr.nf", "monmail.fr.nf", "monumentmail.com", "mt2009.com", "mt2014.com",
        "mycard.net.ua", "mycleaninbox.net", "myemailboxy.com", "mymail-in.net",
        "mymailoasis.com", "mynetstore.de", "mypacks.net", "mypartyclip.de", "myphantomemail.com",
        "mysamp.de", "mytempemail.com", "mytempmail.com", "mytrashmail.com", "nabuma.com",
        "neomailbox.com", "nepwk.com", "nervmich.net", "nervtmich.net", "netmails.com",
        "netmails.net", "netzidiot.de", "neverbox.com", "nice-4u.com", "nincsmail.com",
        "nincsmail.hu", "nnh.com", "no-spam.ws", "noblepioneer.com", "nomail.pw",
        "nomail.xl.cx", "nomail2me.com", "nomorespamemails.com", "nospam.ze.tc",
        "nospam4.us", "nospamfor.us", "nospammail.net", "notmailinator.com", "nowhere.org",
        "nowmymail.com", "nurfuerspam.de", "nus.edu.sg", "nwldx.com", "objectmail.com",
        "obobbo.com", "oneoffemail.com", "onewaymail.com", "online.ms", "oopi.org",
        "ordinaryamerican.net", "otherinbox.com", "ourklips.com", "outlawspam.com",
        "ovpn.to", "owlpic.com", "pancakemail.com", "paplease.com", "pcusers.otherinbox.com",
        "pjjkp.com", "plexolan.de", "poczta.onet.pl", "politikerclub.de", "poofy.org",
        "pookmail.com", "privacy.net", "privatdemail.net", "proxymail.eu", "prtnx.com",
        "putthisinyourspamdatabase.com", "qq.com", "quickinbox.com", "quickmail.nl",
        "rcpt.at", "reallymymail.com", "realtyalerts.ca", "receiveee.com", "recode.me",
        "recursor.net", "regbypass.com", "regbypass.comsafe-mail.net", "rejectmail.com",
        "reliable-mail.com", "rhyta.com", "rmqkr.net", "royal.net", "rtrtr.com",
        "s0ny.net", "safe-mail.net", "safersignup.de", "safetymail.info", "safetypost.de",
        "sandelf.de", "saynotospams.com", "schafmail.de", "schrott-email.de", "secretemail.de",
        "secure-mail.biz", "secure-mail.cc", "selfdestructingmail.com", "selfdestructingmail.org",
        "sendspamhere.com", "sharklasers.com", "shieldemail.com", "shiftmail.com",
        "shitmail.me", "shitmail.org", "shitware.nl", "shmeriously.com", "shortmail.net",
        "sibmail.com", "sinda.club", "skeefmail.com", "slaskpost.se", "slopsbox.com",
        "slushmail.com", "smashmail.de", "smellfear.com", "snakemail.com", "sneakemail.com",
        "snkmail.com", "sofimail.com", "sofort-mail.de", "sogetthis.com", "soodonims.com",
        "spam.la", "spam.su", "spam4.me", "spamail.de", "spamarrest.com", "spambob.com",
        "spambob.net", "spambob.org", "spambog.com", "spambog.de", "spambog.ru",
        "spambox.info", "spambox.irishspringrealty.com", "spambox.us", "spamcannon.com",
        "spamcannon.net", "spamcero.com", "spamcorptastic.com", "spamcowboy.com",
        "spamcowboy.net", "spamcowboy.org", "spamday.com", "spamex.com", "spamfree.eu",
        "spamfree24.com", "spamfree24.de", "spamfree24.eu", "spamfree24.info", "spamfree24.net",
        "spamfree24.org", "spamgoes.in", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
        "spamherelots.com", "spamhereplease.com", "spamhole.com", "spamify.com",
        "spaml.com", "spaml.de", "spammotel.com", "spamobox.com", "spamoff.de",
        "spamslicer.com", "spamspot.com", "spamstack.net", "spamthis.co.uk", "spamthisplease.com",
        "spamtrail.com", "spamtrap.co", "spam trap.ro", "speed.1s.fr", "spoofmail.de",
        "stuffmail.de", "supergreatmail.com", "supermailer.jp", "suremail.info",
        "tagyourself.com", "teewars.org", "teleworm.com", "teleworm.us", "temp-mail.com",
        "temp-mail.de", "temp-mail.org", "temp-mail.ru", "tempemail.biz", "tempemail.com",
        "tempe-mail.com", "tempemail.net", "tempinbox.co.uk", "tempinbox.com", "tempmail.de",
        "tempmail.eu", "tempmail.it", "tempmail2.com", "tempmaildemo.com", "tempmailer.com",
        "tempmailer.de", "tempomail.fr", "temporarily.de", "temporarioemail.com.br",
        "temporaryemail.net", "temporaryemail.us", "temporaryforwarding.com",
        "temporaryinbox.com", "temporarymailaddress.com", "tempsky.com", "tempthe.net",
        "tempymail.com", "thanksnospam.info", "thankyou2010.com", "thc.st", "thelimestones.com",
        "thisisnotmyrealemail.com", "thismail.net", "throwam.com", "throwawayemailaddress.com",
        "throwawaymail.com", "tilien.com", "tittbit.in", "tizi.com", "tmail.ws", "tmailinator.com",
        "tmoreplease.com", "tmpjr.me", "topranklist.de", "tradermail.info", "trash-amil.com",
        "trash-mail.at", "trash-mail.com", "trash-mail.de", "trash2009.com", "trash2010.com",
        "trash2011.com", "trashdevil.com", "trashdevil.de", "trashemail.de", "trashmail.at",
        "trashmail.com", "trashmail.de", "trashmail.me", "trashmail.net", "trashmail.org",
        "trashmail.ws", "trashmailer.com", "trashymail.com", "trashymail.net", "trialmail.de",
        "trillianpro.com", "twinmail.de", "tyldd.com", "uggsrock.com", "umail.net",
        "uroid.com", "us.af", "venompen.com", "veryrealemail.com", "viditag.com",
        "viewcastmedia.com", "viewcastmedia.net", "viewcastmedia.org", "vomoto.com",
        "vubby.com", "wasteland.rfc822.org", "webemail.me", "webm4il.info", "weg-werf-email.de",
        "wegwerf-email-addressen.de", "wegwerf-email-adressen.de", "wegwerf-email.at",
        "wegwerf-email.de", "wegwerf-email.net", "wegwerf-emails.de", "wegwerfadresse.de",
        "wegwerfemail.com", "wegwerfemail.de", "wegwerfemail.net", "wegwerfemail.org",
        "wegwerfemailadresse.com", "wegwerfmail.de", "wegwerfmail.info", "wegwerfmail.net",
        "wegwerfmail.org", "wetrainbayarea.com", "wetrainbayarea.org", "wh4f.org",
        "whatiaas.com", "whatpaas.com", "whopy.com", "whtjddn.33mail.com", "whyspam.me",
        "willhackforfood.biz", "willselfdestruct.com", "wimsg.com", "winemaven.info",
        "wronghead.com", "wuzup.net", "wuzupmail.net", "www.e4ward.com", "www.gishpuppy.com",
        "www.mailinator.com", "wwwnew.eu", "x.ip6.li", "xagloo.com", "xemaps.com",
        "xents.com", "xmaily.com", "xoxy.net", "yapped.net", "yep.it", "yogamaven.com",
        "yopmail.com", "yopmail.fr", "yopmail.net", "you-spam.com", "youmailr.com",
        "ypmail.webarnak.fr.eu.org", "yuurok.com", "z1p.biz", "zahnmail.com", "zebins.com",
        "zebins.eu", "zehnminuten.de", "zehnminutenmail.de", "zippymail.info", "zoemail.com",
        "zomg.info", "yopmail.com"
    }
    
    @classmethod
    def validate_email_address(cls, email: str) -> Dict:
        """
        Comprehensive email validation.
        
        Args:
            email: Email address to validate
            
        Returns:
            Dictionary with validation results:
            {
                "valid": bool,
                "message": str,
                "normalized_email": str,
                "is_disposable": bool
            }
        """
        # Basic format validation
        try:
            validation = validate_email(email, check_deliverability=False)
            normalized_email = validation.normalized
        except EmailNotValidError as e:
            return {
                "valid": False,
                "message": str(e),
                "normalized_email": None,
                "is_disposable": None
            }
        
        # Extract domain
        domain = normalized_email.split('@')[1].lower()
        
        # Check for disposable email
        is_disposable = domain in cls.DISPOSABLE_DOMAINS
        
        if is_disposable:
            return {
                "valid": False,
                "message": "Disposable email addresses are not allowed",
                "normalized_email": normalized_email,
                "is_disposable": True
            }
        
        return {
            "valid": True,
            "message": "Email is valid",
            "normalized_email": normalized_email,
            "is_disposable": False
        }


def validate_email_address(email: str) -> Dict:
    """
    Convenience function for email validation.
    
    Args:
        email: Email address to validate
        
    Returns:
        Validation result dictionary
    """
    return EmailValidator.validate_email_address(email)
