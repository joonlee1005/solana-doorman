/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ticketing_system.json`.
 */
export type TicketingSystem = {
  "address": "2vPTZ9iRydqA3mbkkK6CPXhFuTBdVc8s3otKmfcABiVK",
  "metadata": {
    "name": "ticketingSystem",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "buySeat",
      "discriminator": [
        225,
        111,
        238,
        154,
        123,
        74,
        43,
        234
      ],
      "accounts": [
        {
          "name": "customer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event"
        },
        {
          "name": "organizer",
          "docs": [
            "validated against event.organizer."
          ]
        },
        {
          "name": "seatTier"
        },
        {
          "name": "seat",
          "writable": true
        },
        {
          "name": "ticketMint",
          "writable": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "customerTicketAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "customer"
              },
              {
                "kind": "account",
                "path": "ticketTokenProgram"
              },
              {
                "kind": "account",
                "path": "ticketMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "customerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "customer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "organizerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ticketTokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "paymentTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "checkIn",
      "discriminator": [
        209,
        253,
        4,
        217,
        250,
        241,
        207,
        50
      ],
      "accounts": [
        {
          "name": "staff",
          "signer": true
        },
        {
          "name": "event"
        },
        {
          "name": "seatTier"
        },
        {
          "name": "seat",
          "writable": true
        },
        {
          "name": "ticketTokenAccount"
        }
      ],
      "args": []
    },
    {
      "name": "createEvent",
      "discriminator": [
        49,
        219,
        29,
        203,
        22,
        98,
        100,
        87
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  118,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "arg",
                "path": "eventId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "eventId",
          "type": "u64"
        },
        {
          "name": "jurisdictionRegistry",
          "type": "pubkey"
        },
        {
          "name": "refundDeadline",
          "type": "i64"
        },
        {
          "name": "refundBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createJurisdictionRegistry",
      "discriminator": [
        90,
        121,
        234,
        58,
        90,
        76,
        49,
        45
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "jurisdictionRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  105,
                  115,
                  100,
                  105,
                  99,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "jurisdictionCode"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jurisdictionCode",
          "type": "string"
        },
        {
          "name": "legalCapBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "createSeat",
      "discriminator": [
        91,
        13,
        230,
        183,
        58,
        95,
        118,
        199
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event"
        },
        {
          "name": "seatTier"
        },
        {
          "name": "seat",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "account",
                "path": "seatTier"
              },
              {
                "kind": "arg",
                "path": "seatCode"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seatCode",
          "type": "string"
        },
        {
          "name": "displayName",
          "type": "string"
        }
      ]
    },
    {
      "name": "createSeatTier",
      "discriminator": [
        140,
        119,
        58,
        250,
        2,
        214,
        90,
        223
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event"
        },
        {
          "name": "jurisdictionRegistry"
        },
        {
          "name": "seatTier",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  101,
                  97,
                  116,
                  95,
                  116,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "event"
              },
              {
                "kind": "arg",
                "path": "tierName"
              }
            ]
          }
        },
        {
          "name": "ticketMint",
          "docs": [
            "extension, which the declarative `mint::` constraint does not support)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  99,
                  107,
                  101,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "bidQueue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  95,
                  113,
                  117,
                  101,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "bidQueueVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  95,
                  113,
                  117,
                  101,
                  117,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "ticketTokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "paymentTokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tierName",
          "type": "string"
        },
        {
          "name": "faceValue",
          "type": "u64"
        },
        {
          "name": "organizerResalePolicy",
          "type": {
            "defined": {
              "name": "resalePolicy"
            }
          }
        },
        {
          "name": "totalSeats",
          "type": "u32"
        }
      ]
    },
    {
      "name": "executeResale",
      "discriminator": [
        186,
        13,
        92,
        24,
        194,
        29,
        239,
        175
      ],
      "accounts": [
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "buyer"
        },
        {
          "name": "seatTier"
        },
        {
          "name": "seat",
          "writable": true
        },
        {
          "name": "bidQueue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  95,
                  113,
                  117,
                  101,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "bidQueueVault",
          "writable": true
        },
        {
          "name": "ticketMint"
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "sellerTicketAta",
          "writable": true
        },
        {
          "name": "buyerTicketAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "ticketTokenProgram"
              },
              {
                "kind": "account",
                "path": "ticketMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sellerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ticketTokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "paymentTokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "joinQueue",
      "discriminator": [
        157,
        115,
        48,
        109,
        65,
        86,
        203,
        238
      ],
      "accounts": [
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "seatTier"
        },
        {
          "name": "bidQueue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  95,
                  113,
                  117,
                  101,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "bidQueueVault",
          "writable": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "buyerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "paymentTokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "leaveQueue",
      "discriminator": [
        95,
        75,
        87,
        92,
        172,
        245,
        65,
        97
      ],
      "accounts": [
        {
          "name": "buyer",
          "signer": true
        },
        {
          "name": "seatTier"
        },
        {
          "name": "bidQueue",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  105,
                  100,
                  95,
                  113,
                  117,
                  101,
                  117,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "seatTier"
              }
            ]
          }
        },
        {
          "name": "bidQueueVault",
          "writable": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "buyerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "paymentTokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "refundTicket",
      "discriminator": [
        178,
        97,
        75,
        218,
        227,
        28,
        21,
        73
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "event"
        },
        {
          "name": "seatTier"
        },
        {
          "name": "seat",
          "writable": true
        },
        {
          "name": "paymentMint"
        },
        {
          "name": "customer",
          "docs": [
            "validated against seat.owner."
          ]
        },
        {
          "name": "organizerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "organizer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "customerPaymentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "customer"
              },
              {
                "kind": "account",
                "path": "paymentTokenProgram"
              },
              {
                "kind": "account",
                "path": "paymentMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "paymentTokenProgram"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "bidQueue",
      "discriminator": [
        30,
        229,
        68,
        250,
        79,
        132,
        153,
        91
      ]
    },
    {
      "name": "event",
      "discriminator": [
        125,
        192,
        125,
        158,
        9,
        115,
        152,
        233
      ]
    },
    {
      "name": "jurisdictionRegistry",
      "discriminator": [
        73,
        20,
        2,
        238,
        36,
        118,
        222,
        115
      ]
    },
    {
      "name": "seat",
      "discriminator": [
        90,
        228,
        22,
        90,
        162,
        86,
        173,
        26
      ]
    },
    {
      "name": "seatTier",
      "discriminator": [
        12,
        0,
        211,
        1,
        187,
        165,
        103,
        203
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidMaxBps",
      "msg": "max_bps must be between 0 and 10000"
    },
    {
      "code": 6001,
      "name": "seatNotAvailable",
      "msg": "seat is not available for purchase"
    },
    {
      "code": 6002,
      "name": "seatCodeTooLong",
      "msg": "seat code exceeds max length"
    },
    {
      "code": 6003,
      "name": "displayNameTooLong",
      "msg": "display name exceeds max length"
    },
    {
      "code": 6004,
      "name": "tierNameTooLong",
      "msg": "tier name exceeds max length"
    },
    {
      "code": 6005,
      "name": "jurisdictionCodeTooLong",
      "msg": "jurisdiction code exceeds max length"
    },
    {
      "code": 6006,
      "name": "resalePriceExceedsCap",
      "msg": "resale price exceeds policy cap"
    },
    {
      "code": 6007,
      "name": "refundDeadlinePassed",
      "msg": "refund deadline has passed"
    },
    {
      "code": 6008,
      "name": "invalidSeatStatus",
      "msg": "ticket already checked in or invalid state for this operation"
    },
    {
      "code": 6009,
      "name": "unauthorized",
      "msg": "caller is not authorized organizer"
    },
    {
      "code": 6010,
      "name": "queueFull",
      "msg": "bid queue is full"
    },
    {
      "code": 6011,
      "name": "queueEmpty",
      "msg": "bid queue is empty, nothing to resell"
    },
    {
      "code": 6012,
      "name": "bidExceedsCap",
      "msg": "bid amount exceeds resale policy cap"
    },
    {
      "code": 6013,
      "name": "notInQueue",
      "msg": "caller has no bid in this queue"
    },
    {
      "code": 6014,
      "name": "queueFrontMismatch",
      "msg": "supplied buyer does not match the queue front"
    }
  ],
  "types": [
    {
      "name": "bid",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "bidQueue",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seatTier",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "bids",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "bid"
                  }
                },
                20
              ]
            }
          },
          {
            "name": "count",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "event",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "eventId",
            "type": "u64"
          },
          {
            "name": "jurisdictionRegistry",
            "type": "pubkey"
          },
          {
            "name": "refundDeadline",
            "type": "i64"
          },
          {
            "name": "refundBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "jurisdictionRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "jurisdictionCode",
            "type": "string"
          },
          {
            "name": "legalCapBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "resalePolicy",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "capped",
            "fields": [
              {
                "name": "maxBps",
                "type": "u16"
              }
            ]
          },
          {
            "name": "unrestricted"
          },
          {
            "name": "nonTransferable"
          }
        ]
      }
    },
    {
      "name": "seat",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seatTier",
            "type": "pubkey"
          },
          {
            "name": "seatCode",
            "type": "string"
          },
          {
            "name": "displayName",
            "type": "string"
          },
          {
            "name": "tokenAccount",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "seatStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "seatStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "available"
          },
          {
            "name": "sold"
          },
          {
            "name": "refunded"
          },
          {
            "name": "checkedIn"
          }
        ]
      }
    },
    {
      "name": "seatTier",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "event",
            "type": "pubkey"
          },
          {
            "name": "tierName",
            "type": "string"
          },
          {
            "name": "ticketMint",
            "type": "pubkey"
          },
          {
            "name": "paymentMint",
            "type": "pubkey"
          },
          {
            "name": "faceValue",
            "type": "u64"
          },
          {
            "name": "resalePolicy",
            "type": {
              "defined": {
                "name": "resalePolicy"
              }
            }
          },
          {
            "name": "totalSeats",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
