// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title MockUSDT - Test USDT token with public faucet and gasless approvals (EIP-2612)
contract MockUSDT is ERC20, ERC20Permit {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USDT", "USDT") ERC20Permit("Mock USDT") {
        _mint(msg.sender, 1_000_000 * 10 ** DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Anyone can mint test tokens (faucet for demo)
    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 10 ** DECIMALS, "MockUSDT: max 10k per faucet");
        _mint(msg.sender, amount);
    }

    /// @notice Convenience: mint 1000 USDT to caller
    function faucet() external {
        _mint(msg.sender, 1_000 * 10 ** DECIMALS);
    }
}
