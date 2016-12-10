import bigInt from 'big-integer'
import EvpKDF from 'crypto-js/pbkdf2'
import SHA256 from 'crypto-js/sha256'
import HMAC from 'crypto-js/hmac'
import crypto from 'crypto-js'

const pbkdf2 = (masterPassword, salt, iterations, keylen, digest) => {

	//TODO: digest -> hasher
	//TODO: keylen -> keysize 

	return new Promise((resolve, reject) => resolve(
        EvpKDF(masterPassword, salt, {keySize: 8, iterations: iterations, hasher: crypto.algo.SHA256 })))
}

export default function generatePassword(site, login, masterPassword, passwordProfile) {
    return calcEntropy(site, login, masterPassword, passwordProfile).then(function (entropy) {
        return renderPassword(entropy.toString(), passwordProfile);
    });
}

function calcEntropy(site, login, masterPassword, passwordProfile) {
    var salt = site + login + passwordProfile.counter.toString(16);
    return pbkdf2(masterPassword, salt, passwordProfile.iterations, passwordProfile.keylen, passwordProfile.digest);
}

var characterSubsets = {
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    symbols: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'
};

function getSetOfCharacters(rules) {
    if (typeof rules === 'undefined') {
        return characterSubsets.lowercase + characterSubsets.uppercase + characterSubsets.numbers + characterSubsets.symbols;
    }
    var setOfChars = '';
    rules.forEach(function (rule) {
        setOfChars += characterSubsets[rule];
    });
    return setOfChars;
}

function consumeEntropy(generatedPassword, quotient, setOfCharacters, maxLength) {
    if (generatedPassword.length >= maxLength) {
        return {value: generatedPassword, entropy: quotient};
    }
    var longDivision = quotient.divmod(setOfCharacters.length);
    generatedPassword += setOfCharacters[longDivision.remainder];
    return consumeEntropy(generatedPassword, longDivision.quotient, setOfCharacters, maxLength);
}

function insertStringPseudoRandomly(generatedPassword, entropy, string) {
    for (var i = 0; i < string.length; i++) {
        var longDivision = entropy.divmod(generatedPassword.length);
        generatedPassword = generatedPassword.slice(0, longDivision.remainder) 
			+ string[i] 
			+ generatedPassword.slice(longDivision.remainder);
        entropy = longDivision.quotient;
    }
    return generatedPassword;
}

function getOneCharPerRule(entropy, rules) {
    var oneCharPerRules = '';
    rules.forEach(function (rule) {
        var password = consumeEntropy('', entropy, characterSubsets[rule], 1);
        oneCharPerRules += password.value;
        entropy = password.entropy;
    });
    return {value: oneCharPerRules, entropy: entropy};
}

function getConfiguredRules(passwordProfile) {
    return ['lowercase', 'uppercase', 'numbers', 'symbols'].filter(function (rule) {
        return passwordProfile[rule];
    });
}

function renderPassword(entropy, passwordProfile) {
    var rules = getConfiguredRules(passwordProfile);
    var setOfCharacters = getSetOfCharacters(rules);
    var password = consumeEntropy('', bigInt(entropy, 16), setOfCharacters, passwordProfile.length - rules.length);
    var charactersToAdd = getOneCharPerRule(password.entropy, rules);
    return insertStringPseudoRandomly(password.value, charactersToAdd.entropy, charactersToAdd.value);
}