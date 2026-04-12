// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title OutcomeToken - ERC-20 token representing a prediction market outcome (YES or NO)
/// @notice Only the parent PredictionMarket contract can mint and burn tokens. Supports gasless approvals via EIP-2612.
contract OutcomeToken is ERC20, ERC20Permit {
    address public immutable market;

    modifier onlyMarket() {
        require(msg.sender == market, "OutcomeToken: caller is not the market");
        _;
    }

    constructor(string memory name_, string memory symbol_, address market_) ERC20(name_, symbol_) ERC20Permit(name_) {
        market = market_;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyMarket {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyMarket {
        _burn(from, amount);
    }
}
