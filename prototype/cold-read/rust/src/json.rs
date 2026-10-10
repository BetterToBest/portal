// Own JSON parser: exact number handling, duplicate keys kept, strings as UTF-16 units.
#[derive(Debug, Clone)]
pub enum V {
    Null,
    Bool(bool),
    /// Some(i) = whole number within the safe range; None = any other number (not allowed).
    Num(Option<i64>),
    Str(Vec<u16>),
    Arr(Vec<V>),
    Obj(Vec<(Vec<u16>, V)>),
}

impl V {
    pub fn get(&self, key: &str) -> Option<&V> {
        if let V::Obj(m) = self {
            let k: Vec<u16> = key.encode_utf16().collect();
            for (kk, v) in m {
                if *kk == k {
                    return Some(v);
                }
            }
        }
        None
    }
    pub fn as_int(&self) -> Option<i64> {
        if let V::Num(Some(i)) = self { Some(*i) } else { None }
    }
    pub fn as_string(&self) -> Option<String> {
        if let V::Str(u) = self { String::from_utf16(u).ok() } else { None }
    }
    /// object has exactly these keys (each once)
    pub fn has_exact_keys(&self, keys: &[&str]) -> bool {
        if let V::Obj(m) = self {
            if m.len() != keys.len() {
                return false;
            }
            keys.iter().all(|k| {
                let ku: Vec<u16> = k.encode_utf16().collect();
                m.iter().filter(|(kk, _)| *kk == ku).count() == 1
            })
        } else {
            false
        }
    }
}

struct P<'a> {
    b: &'a [u8],
    i: usize,
}

const MAXDEPTH: usize = 3000;

pub fn parse(bytes: &[u8]) -> Result<V, String> {
    if std::str::from_utf8(bytes).is_err() {
        return Err("invalid UTF-8".into());
    }
    let mut p = P { b: bytes, i: 0 };
    p.ws();
    let v = p.value(0)?;
    p.ws();
    if p.i != p.b.len() {
        return Err("trailing data".into());
    }
    Ok(v)
}

impl<'a> P<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }
    fn peek(&self) -> Option<u8> {
        self.b.get(self.i).copied()
    }
    fn lit(&mut self, s: &str, v: V) -> Result<V, String> {
        if self.b[self.i..].starts_with(s.as_bytes()) {
            self.i += s.len();
            Ok(v)
        } else {
            Err("bad literal".into())
        }
    }
    fn value(&mut self, depth: usize) -> Result<V, String> {
        if depth > MAXDEPTH {
            return Err("too deep".into());
        }
        match self.peek() {
            None => Err("unexpected end".into()),
            Some(b'n') => self.lit("null", V::Null),
            Some(b't') => self.lit("true", V::Bool(true)),
            Some(b'f') => self.lit("false", V::Bool(false)),
            Some(b'"') => Ok(V::Str(self.string()?)),
            Some(b'[') => {
                self.i += 1;
                let mut a = vec![];
                self.ws();
                if self.peek() == Some(b']') {
                    self.i += 1;
                    return Ok(V::Arr(a));
                }
                loop {
                    self.ws();
                    a.push(self.value(depth + 1)?);
                    self.ws();
                    match self.peek() {
                        Some(b',') => self.i += 1,
                        Some(b']') => {
                            self.i += 1;
                            return Ok(V::Arr(a));
                        }
                        _ => return Err("bad array".into()),
                    }
                }
            }
            Some(b'{') => {
                self.i += 1;
                let mut m = vec![];
                self.ws();
                if self.peek() == Some(b'}') {
                    self.i += 1;
                    return Ok(V::Obj(m));
                }
                loop {
                    self.ws();
                    if self.peek() != Some(b'"') {
                        return Err("bad key".into());
                    }
                    let k = self.string()?;
                    self.ws();
                    if self.peek() != Some(b':') {
                        return Err("missing colon".into());
                    }
                    self.i += 1;
                    self.ws();
                    let v = self.value(depth + 1)?;
                    m.push((k, v));
                    self.ws();
                    match self.peek() {
                        Some(b',') => self.i += 1,
                        Some(b'}') => {
                            self.i += 1;
                            return Ok(V::Obj(m));
                        }
                        _ => return Err("bad object".into()),
                    }
                }
            }
            Some(c) if c == b'-' || c.is_ascii_digit() => self.number(),
            _ => Err("unexpected char".into()),
        }
    }
    fn string(&mut self) -> Result<Vec<u16>, String> {
        self.i += 1; // opening quote
        let mut out: Vec<u16> = vec![];
        loop {
            let c = *self.b.get(self.i).ok_or("unterminated string")?;
            match c {
                b'"' => {
                    self.i += 1;
                    return Ok(out);
                }
                b'\\' => {
                    self.i += 1;
                    let e = *self.b.get(self.i).ok_or("bad escape")?;
                    self.i += 1;
                    match e {
                        b'"' => out.push(0x22),
                        b'\\' => out.push(0x5c),
                        b'/' => out.push(0x2f),
                        b'b' => out.push(8),
                        b'f' => out.push(12),
                        b'n' => out.push(10),
                        b'r' => out.push(13),
                        b't' => out.push(9),
                        b'u' => {
                            if self.i + 4 > self.b.len() {
                                return Err("bad \\u".into());
                            }
                            let mut u: u16 = 0;
                            for k in 0..4 {
                                let h = (self.b[self.i + k] as char).to_digit(16).ok_or("bad \\u")?;
                                u = u * 16 + h as u16;
                            }
                            self.i += 4;
                            out.push(u);
                        }
                        _ => return Err("bad escape".into()),
                    }
                }
                c if c < 0x20 => return Err("control char in string".into()),
                c => {
                    let len = if c < 0x80 { 1 } else if c >= 0xf0 { 4 } else if c >= 0xe0 { 3 } else { 2 };
                    let s = std::str::from_utf8(&self.b[self.i..self.i + len]).map_err(|_| "utf8")?;
                    out.extend(s.encode_utf16());
                    self.i += len;
                }
            }
        }
    }
    fn digits(&mut self) -> String {
        let s = self.i;
        while self.i < self.b.len() && self.b[self.i].is_ascii_digit() {
            self.i += 1;
        }
        String::from_utf8_lossy(&self.b[s..self.i]).into_owned()
    }
    fn number(&mut self) -> Result<V, String> {
        let mut neg = false;
        if self.peek() == Some(b'-') {
            neg = true;
            self.i += 1;
        }
        let int = self.digits();
        if int.is_empty() || (int.len() > 1 && int.starts_with('0')) {
            return Err("bad number".into());
        }
        let mut frac = String::new();
        if self.peek() == Some(b'.') {
            self.i += 1;
            frac = self.digits();
            if frac.is_empty() {
                return Err("bad number".into());
            }
        }
        let mut exp: i128 = 0;
        if matches!(self.peek(), Some(b'e') | Some(b'E')) {
            self.i += 1;
            let mut eneg = false;
            match self.peek() {
                Some(b'+') => self.i += 1,
                Some(b'-') => {
                    eneg = true;
                    self.i += 1
                }
                _ => {}
            }
            let ed = self.digits();
            if ed.is_empty() {
                return Err("bad number".into());
            }
            for ch in ed.bytes() {
                exp = (exp * 10 + (ch - b'0') as i128).min(1_000_000_000_000_000);
            }
            if eneg {
                exp = -exp;
            }
        }
        // exact evaluation
        let mut all = format!("{}{}", int, frac);
        let mut e10: i128 = exp - frac.len() as i128;
        let trimmed = all.trim_start_matches('0').to_string();
        all = trimmed;
        if all.is_empty() {
            return Ok(V::Num(Some(0)));
        }
        while all.ends_with('0') {
            all.pop();
            e10 += 1;
        }
        if e10 < 0 {
            return Ok(V::Num(None));
        }
        if all.len() as i128 + e10 > 16 {
            return Ok(V::Num(None));
        }
        let mut val: i128 = all.parse().unwrap();
        for _ in 0..e10 {
            val *= 10;
        }
        if val > 9007199254740991 {
            return Ok(V::Num(None));
        }
        Ok(V::Num(Some(if neg { -(val as i64) } else { val as i64 })))
    }
}

pub fn canon_str(u: &[u16], out: &mut String) -> bool {
    let s = match String::from_utf16(u) {
        Ok(s) => s,
        Err(_) => return false,
    };
    out.push('"');
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{8}' => out.push_str("\\b"),
            '\u{c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    true
}

/// Canonical form; None if the value contains anything not allowed by section 2
/// (null, booleans, non-integer/out-of-range numbers, unpaired surrogates) or a duplicate key.
pub fn canon(v: &V) -> Option<String> {
    let mut s = String::new();
    if canon_into(v, &mut s) { Some(s) } else { None }
}

fn canon_into(v: &V, out: &mut String) -> bool {
    match v {
        V::Null | V::Bool(_) | V::Num(None) => false,
        V::Num(Some(i)) => {
            out.push_str(&i.to_string());
            true
        }
        V::Str(u) => canon_str(u, out),
        V::Arr(a) => {
            out.push('[');
            for (n, x) in a.iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                if !canon_into(x, out) {
                    return false;
                }
            }
            out.push(']');
            true
        }
        V::Obj(m) => {
            let mut idx: Vec<usize> = (0..m.len()).collect();
            idx.sort_by(|&a, &b| m[a].0.cmp(&m[b].0));
            for w in idx.windows(2) {
                if m[w[0]].0 == m[w[1]].0 {
                    return false;
                }
            }
            out.push('{');
            for (n, &k) in idx.iter().enumerate() {
                if n > 0 {
                    out.push(',');
                }
                if !canon_str(&m[k].0, out) {
                    return false;
                }
                out.push(':');
                if !canon_into(&m[k].1, out) {
                    return false;
                }
            }
            out.push('}');
            true
        }
    }
}
